// Single source of truth for the app's basePath. The console is reverse-
// proxied by the main site at forecasting-agent.com/pm/*, so Next serves
// everything (pages, /api/*, /_next/*) under this prefix — dev and prod
// alike. (Same pattern as apps/raven-delta/lib/base-path.ts.)

export const BASE_PATH = "/pm";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
