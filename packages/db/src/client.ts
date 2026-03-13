import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (dbInstance) {
    return dbInstance;
  }

  const client = postgres(process.env.DATABASE_URL, {
    max: 5,
    prepare: false
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

