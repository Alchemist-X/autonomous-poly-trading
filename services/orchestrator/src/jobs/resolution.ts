import { randomUUID } from "node:crypto";
import { getDb, getPublicPositions, resolutionChecks } from "@autopoly/db";

export async function runResolutionSweep(intervalMinutes: number) {
  const db = getDb();
  const positions = await getPublicPositions();
  const now = new Date();

  for (const position of positions) {
    await db.insert(resolutionChecks).values({
      id: randomUUID(),
      eventSlug: position.event_slug,
      marketSlug: position.market_slug,
      trackStatus: "watching",
      intervalMinutes,
      nextCheckAt: new Date(now.getTime() + intervalMinutes * 60 * 1000),
      lastCheckedAt: now,
      summary: "Position is under automated resolution tracking.",
      metadata: {
        token_id: position.token_id,
        side: position.side
      }
    });
  }
}

