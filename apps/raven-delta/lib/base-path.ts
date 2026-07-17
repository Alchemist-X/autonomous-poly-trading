// Single source of truth for the app's basePath. The app is reverse-proxied
// by the main site at forecasting-agent.com/delta/*, so Next serves everything
// (pages, /api/*, /_next/*) under this prefix — in dev and prod alike.
//
// Imported by next.config.ts (build-time config) and by client code that
// hand-writes fetch URLs (Next only auto-prefixes router/asset URLs, not
// window.fetch calls).

export const BASE_PATH = "/delta";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
