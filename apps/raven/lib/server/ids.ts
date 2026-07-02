// Forecast ids are engine-generated slugs (see makeEventId) — constrain the
// param before it ever reaches a filesystem path.
export function isSafeEventId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(id);
}
