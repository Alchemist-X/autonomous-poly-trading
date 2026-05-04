// Tiny re-export shim over `@autopoly/db` schema.
//
// Centralizes the imports the dispatcher needs and exposes a `Db` type
// alias so tests can mock just the operations we use without depending
// on the full Postgres-js driver shape.

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import {
  managedDecisions as managedDecisionsTable,
  managedPaperRuns as managedPaperRunsTable,
  managedUsers as managedUsersTable
} from "@autopoly/db";

export const managedDecisions = managedDecisionsTable;
export const managedPaperRuns = managedPaperRunsTable;
export const managedUsers = managedUsersTable;

// We use a relaxed `Db` type so test mocks can implement just the
// `select` / `insert` / `update` chains the dispatcher uses without
// reproducing the full Drizzle generic surface.
export type Db = PostgresJsDatabase<Record<string, unknown>>;

// Re-export the schema module symbol for downstream type inference.
export type schemaModule = {
  readonly managedDecisions: typeof managedDecisionsTable;
  readonly managedPaperRuns: typeof managedPaperRunsTable;
  readonly managedUsers: typeof managedUsersTable;
};
