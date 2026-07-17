// Single source of truth for the URL prefix this app is mounted under
// (forecasting-agent.com/engine/* via the main site's reverse proxy).
//
// next.config.ts consumes BASE_PATH for Next's `basePath`. Next auto-prefixes
// router navigations, <Link> and next/image — but NOT hand-written URLs
// (fetch/EventSource/WebSocket/plain <img src>), which must use withBasePath.
export const BASE_PATH = "/engine";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
