import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { vanDb?: DB };

function create(): DB | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // prepare: false keeps this compatible with Neon's pooled (PgBouncer) connection string.
  const client = postgres(url, { prepare: false, max: 5 });
  return drizzle(client, { schema });
}

/** The database, or null when DATABASE_URL is not set. */
export const db: DB | null = globalForDb.vanDb ?? create();
if (db && process.env.NODE_ENV !== "production") globalForDb.vanDb = db;

export function requireDb(): DB {
  if (!db) throw new Error("DATABASE_URL is not set");
  return db;
}

export { schema };
