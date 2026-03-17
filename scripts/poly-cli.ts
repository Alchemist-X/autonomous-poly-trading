import { pathToFileURL } from "node:url";
import type { ExecutorConfig } from "../services/executor/src/config.ts";
import {
  computeAvgCost,
  executeMarketOrder,
  fetchActiveMarkets,
  fetchEventBySlug,
  fetchMarketBySlug,
  fetchRemotePositions,
  getCollateralBalanceAllowance,
  readBook
} from "../services/executor/src/lib/polymarket-sdk.ts";

type PolyCliAction =
  | "read-book"
  | "fetch-remote-positions"
  | "compute-avg-cost"
  | "get-collateral-balance-allowance"
  | "fetch-event-by-slug"
  | "fetch-market-by-slug"
  | "fetch-active-markets"
  | "execute-market-order";

interface PolyCliPayload {
  action: PolyCliAction;
  config: ExecutorConfig;
  input?: unknown;
}

interface PolyCliEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function runPayload(payload: PolyCliPayload) {
  switch (payload.action) {
    case "read-book": {
      const tokenId = String((payload.input as { tokenId?: unknown })?.tokenId ?? "");
      if (!tokenId) {
        throw new Error("read-book requires input.tokenId");
      }
      return await readBook(payload.config, tokenId);
    }
    case "fetch-remote-positions":
      return await fetchRemotePositions(payload.config);
    case "compute-avg-cost": {
      const tokenId = String((payload.input as { tokenId?: unknown })?.tokenId ?? "");
      if (!tokenId) {
        throw new Error("compute-avg-cost requires input.tokenId");
      }
      return await computeAvgCost(payload.config, tokenId);
    }
    case "get-collateral-balance-allowance":
      return await getCollateralBalanceAllowance(payload.config);
    case "fetch-event-by-slug": {
      const slug = String((payload.input as { slug?: unknown })?.slug ?? "");
      if (!slug) {
        throw new Error("fetch-event-by-slug requires input.slug");
      }
      return await fetchEventBySlug(payload.config, slug);
    }
    case "fetch-market-by-slug": {
      const slug = String((payload.input as { slug?: unknown })?.slug ?? "");
      if (!slug) {
        throw new Error("fetch-market-by-slug requires input.slug");
      }
      return await fetchMarketBySlug(payload.config, slug);
    }
    case "fetch-active-markets": {
      const limit = Number((payload.input as { limit?: unknown })?.limit ?? 100);
      return await fetchActiveMarkets(payload.config, limit);
    }
    case "execute-market-order": {
      const signal = payload.input as { tokenId?: unknown; side?: unknown; amount?: unknown } | undefined;
      const tokenId = String(signal?.tokenId ?? "");
      const side = signal?.side === "SELL" ? "SELL" : signal?.side === "BUY" ? "BUY" : null;
      const amount = Number(signal?.amount ?? NaN);
      if (!tokenId || side == null || !Number.isFinite(amount)) {
        throw new Error("execute-market-order requires input.tokenId/input.side/input.amount");
      }
      return await executeMarketOrder(payload.config, {
        tokenId,
        side,
        amount
      });
    }
    default:
      throw new Error(`Unsupported action: ${(payload as { action?: unknown }).action ?? "unknown"}`);
  }
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) {
      throw new Error("Missing JSON payload on stdin.");
    }
    const payload = JSON.parse(raw) as PolyCliPayload;
    const data = await runPayload(payload);
    const envelope: PolyCliEnvelope<unknown> = { ok: true, data };
    process.stdout.write(JSON.stringify(envelope));
  } catch (error) {
    const envelope: PolyCliEnvelope<never> = { ok: false, error: getErrorMessage(error) };
    process.stdout.write(JSON.stringify(envelope));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main();
}
