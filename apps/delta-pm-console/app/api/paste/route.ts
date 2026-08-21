// POST /api/paste — forwards operator input to `${DELTAPM_STATUS_URL}/ingest`
// with the x-delta-pm-token header. Two whitelisted modes (fields are picked
// explicitly; nothing else is proxied through):
//   { mode: "paste_full_text", newsId, fullText }   — 补全某条新闻的原文
//   { mode: "manual_news", title, text, url? }      — 手动注入一条新闻
// DELTAPM_CONSOLE_MOCK=1 simulates success without a live service.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUS_URL = process.env.DELTAPM_STATUS_URL ?? "http://127.0.0.1:8792";
const MOCK = process.env.DELTAPM_CONSOLE_MOCK === "1";
const FORWARD_TIMEOUT_MS = 5000;

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("请求体不是合法 JSON", 400);
  }
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!body) return fail("请求体格式不正确", 400);

  let forward: Record<string, unknown>;
  if (body.mode === "paste_full_text") {
    const newsId = pickString(body.newsId);
    const fullText = pickString(body.fullText);
    if (!newsId) return fail("缺少 newsId", 400);
    if (!fullText) return fail("原文内容为空", 400);
    forward = { mode: "paste_full_text", newsId, fullText };
  } else if (body.mode === "manual_news") {
    const title = pickString(body.title);
    const text = pickString(body.text);
    if (!title) return fail("缺少标题", 400);
    if (!text) return fail("缺少正文", 400);
    forward = { mode: "manual_news", title, text, url: pickString(body.url) };
  } else {
    return fail("未知的 mode", 400);
  }

  if (MOCK) {
    return NextResponse.json({ ok: true, mock: true });
  }

  const token = process.env.DELTAPM_INGEST_TOKEN;
  if (!token) return fail("未配置 DELTAPM_INGEST_TOKEN", 503);

  try {
    const res = await fetch(`${STATUS_URL}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-delta-pm-token": token },
      body: JSON.stringify(forward),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return fail(`服务返回 HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`, 502);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`转发失败: ${message}`, 502);
  }
}
