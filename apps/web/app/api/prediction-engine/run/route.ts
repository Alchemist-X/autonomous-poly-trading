import { NextResponse } from "next/server";
import { buildPredictionDemoRun } from "../../../../lib/prediction-engine-demo";
import {
  completePredictionUsageEvent,
  consumePredictionRunQuota
} from "../../../../lib/prediction-access";

export const runtime = "nodejs";

const DEFAULT_BACKEND_TIMEOUT_MS = 120_000;
const DEFAULT_BACKEND_PATH = "/prediction-engine/run";

type PredictionBackendSource = "local" | "vps";

interface PredictionBackendConfig {
  url: string;
  source: PredictionBackendSource;
  token: string | null;
}

function readEventText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.slice(0, 600);
}

function readMarketPrice(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBackendTimeoutMs(): number {
  const parsed = Number(process.env.PREDICTION_ENGINE_API_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKEND_TIMEOUT_MS;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildEndpointFromBaseUrl(value: string | undefined): string | null {
  const baseUrl = value?.trim();
  if (!baseUrl) {
    return null;
  }
  return `${normalizeBaseUrl(baseUrl)}${DEFAULT_BACKEND_PATH}`;
}

function resolveLocalBackend(): PredictionBackendConfig | null {
  const url = process.env.PREDICTION_ENGINE_LOCAL_API_URL?.trim()
    || buildEndpointFromBaseUrl(process.env.PREDICTION_ENGINE_LOCAL_API_BASE_URL);
  if (!url) {
    return null;
  }
  return {
    url,
    source: "local",
    token: process.env.PREDICTION_ENGINE_LOCAL_API_TOKEN?.trim() || process.env.PREDICTION_ENGINE_API_TOKEN?.trim() || null
  };
}

function resolveVpsBackend(): PredictionBackendConfig | null {
  const url = process.env.PREDICTION_ENGINE_API_URL?.trim()
    || buildEndpointFromBaseUrl(process.env.PREDICTION_ENGINE_API_BASE_URL)
    || buildEndpointFromBaseUrl(process.env.PREDICTION_ENGINE_VPS_URL);
  if (!url) {
    return null;
  }
  return {
    url,
    source: "vps",
    token: process.env.PREDICTION_ENGINE_API_TOKEN?.trim() || null
  };
}

function resolvePredictionBackend(): PredictionBackendConfig | null | NextResponse {
  const mode = (process.env.PREDICTION_ENGINE_BACKEND_MODE?.trim().toLowerCase() || "auto");
  if (mode === "demo" || mode === "off" || mode === "none") {
    return null;
  }
  if (mode === "local") {
    const localBackend = resolveLocalBackend();
    if (localBackend) {
      return localBackend;
    }
    return NextResponse.json({
      error: "PREDICTION_ENGINE_BACKEND_MODE=local but no local backend URL is configured.",
      requiredEnv: ["PREDICTION_ENGINE_LOCAL_API_URL", "PREDICTION_ENGINE_LOCAL_API_BASE_URL"]
    }, { status: 500 });
  }
  if (mode === "vps" || mode === "production") {
    const vpsBackend = resolveVpsBackend();
    if (vpsBackend) {
      return vpsBackend;
    }
    return NextResponse.json({
      error: "PREDICTION_ENGINE_BACKEND_MODE=vps but no VPS backend URL is configured.",
      requiredEnv: ["PREDICTION_ENGINE_API_URL", "PREDICTION_ENGINE_API_BASE_URL", "PREDICTION_ENGINE_VPS_URL"]
    }, { status: 500 });
  }
  if (mode !== "auto") {
    return NextResponse.json({
      error: "Unsupported PREDICTION_ENGINE_BACKEND_MODE.",
      mode,
      supportedModes: ["auto", "local", "vps", "demo"]
    }, { status: 500 });
  }

  const localBackend = process.env.VERCEL ? null : resolveLocalBackend();
  return localBackend ?? resolveVpsBackend();
}

function safeEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url.slice(0, 180);
  }
}

function withBackendMetadata(body: unknown, input: {
  backend: PredictionBackendConfig;
  elapsedMs: number;
}): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const record = body as Record<string, unknown>;
  if (!("conclusion" in record) || !("stages" in record)) {
    return body;
  }
  const serviceRecord = record.service && typeof record.service === "object" && !Array.isArray(record.service)
    ? record.service as Record<string, unknown>
    : {};
  return {
    ...record,
    mode: record.mode ?? (input.backend.source === "local" ? "local_proxy" : "vps_proxy"),
    service: {
      ...serviceRecord,
      source: serviceRecord.source ?? input.backend.source,
      endpointLabel: serviceRecord.endpointLabel ?? safeEndpointLabel(input.backend.url),
      status: serviceRecord.status ?? "complete",
      elapsedMs: serviceRecord.elapsedMs ?? input.elapsedMs,
      note: serviceRecord.note ?? (
        input.backend.source === "local"
          ? "本地 Next route 已调用本机 host 的预测服务。"
          : "Vercel route 已调用 VPS-hosted 预测服务。"
      )
    }
  };
}

async function callPredictionBackend(input: {
  backend: PredictionBackendConfig;
  payload: {
    eventText: string;
    marketPrice: number | null;
  };
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), readBackendTimeoutMs());
  const startedAt = Date.now();
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (input.backend.token) {
      headers.authorization = `Bearer ${input.backend.token}`;
    }
    const response = await fetch(input.backend.url, {
      method: "POST",
      headers,
      body: JSON.stringify(input.payload),
      signal: controller.signal
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text.slice(0, 2000) };
      }
    }
    if (!response.ok) {
      return NextResponse.json({
        error: "Prediction backend request failed.",
        backendSource: input.backend.source,
        backendUrl: safeEndpointLabel(input.backend.url),
        status: response.status,
        body
      }, { status: 502 });
    }
    return NextResponse.json(withBackendMetadata(body, {
      backend: input.backend,
      elapsedMs: Date.now() - startedAt
    }), {
      headers: {
        "x-prediction-engine-backend": input.backend.source
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: "Prediction backend is unavailable.",
      backendSource: input.backend.source,
      backendUrl: safeEndpointLabel(input.backend.url),
      message: error instanceof Error ? error.message : String(error)
    }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const payload = {
    eventText: readEventText(record.eventText),
    marketPrice: readMarketPrice(record.marketPrice)
  };
  const quota = await consumePredictionRunQuota(payload.eventText);
  if (!quota.allowed) {
    return NextResponse.json({
      error: quota.error,
      access: quota.access,
      redirectTo: quota.access.signInUrl ?? quota.access.inviteUrl
    }, { status: quota.status });
  }

  const backend = resolvePredictionBackend();
  if (backend instanceof NextResponse) {
    await completePredictionUsageEvent({
      usageEventId: quota.usageEventId,
      status: "failed",
      errorMessage: "Prediction backend configuration error."
    });
    return backend;
  }
  if (backend) {
    const response = await callPredictionBackend({
      backend,
      payload
    });
    await completePredictionUsageEvent({
      usageEventId: quota.usageEventId,
      status: response.status >= 400 ? "failed" : "complete",
      backendSource: backend.source,
      errorMessage: response.status >= 400 ? `Prediction backend returned ${response.status}.` : null
    });
    return response;
  }

  const run = buildPredictionDemoRun(payload);
  await completePredictionUsageEvent({
    usageEventId: quota.usageEventId,
    status: "complete",
    backendSource: "demo"
  });
  return NextResponse.json(run);
}
