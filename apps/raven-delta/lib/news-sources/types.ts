// News-source seam. Raven Delta's pipeline is source-agnostic: anything that
// can produce a NewsInput can drive it. v1 ships two entry points:
//   1. the console form (human paste),
//   2. POST /api/ingest (machine feed — token-gated).
//
// A future Twitter/X adapter is a small process that polls the API, filters
// to credible accounts, maps each post to a NewsInput, and POSTs it to
// /api/ingest with the access token. It needs zero changes inside the app —
// implement NewsSourceAdapter and point it at the ingest URL.

import type { NewsInput } from "../analyzer/schema";

export interface NewsSourceAdapter {
  // Stable id, e.g. "twitter", "rss:reuters", "manual".
  readonly id: string;
  // Begin watching; call `emit` for every new credible item. Return a stop fn.
  start(emit: (item: NewsInput) => Promise<void>): Promise<() => Promise<void>>;
}

export interface IngestClientOptions {
  ingestUrl: string; // e.g. http://127.0.0.1:3300/api/ingest
  accessToken?: string;
}

// Reference emitter for adapters living outside the app process.
export function createIngestEmitter(options: IngestClientOptions): (item: NewsInput) => Promise<void> {
  return async (item: NewsInput) => {
    const response = await fetch(options.ingestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {})
      },
      body: JSON.stringify(item)
    });
    if (!response.ok) {
      throw new Error(`ingest rejected: ${response.status}`);
    }
  };
}
