import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Is the site up, where does it run, where is its database and how far away (for speed checks and uptime monitors). */
export async function GET() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "").hostname;
    } catch {
      return "";
    }
  })();
  // Only the region part of the address (e.g. "ap-southeast-1"), never the address itself.
  const dbRegion = host.match(/\.([a-z]{2}-[a-z]+-\d)\./)?.[1] ?? null;
  let dbMs: number[] = [];
  if (db) {
    for (let i = 0; i < 3; i++) {
      const t = performance.now();
      await db.execute(sql`select 1`);
      dbMs.push(Math.round(performance.now() - t));
    }
  } else dbMs = [];
  return NextResponse.json({ ok: true, region: process.env.VERCEL_REGION ?? null, dbRegion, dbMs }, { headers: { "cache-control": "no-store" } });
}
