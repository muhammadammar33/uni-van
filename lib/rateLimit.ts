import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { requireDb } from "@/lib/db";
import { BookingError } from "@/lib/trips";

/** The visitor's IP as Vercel reports it (it sets x-forwarded-for itself), hashed so it is never stored. */
export function clientKey(h: Headers): string {
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 24);
}

/** Adds one to a counter that resets `windowSec` after its first hit; returns the new count. */
export async function bump(key: string, windowSec: number): Promise<number> {
  const db = requireDb();
  const [row] = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at) values (${key}, 1, now() + make_interval(secs => ${windowSec}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now() then now() + make_interval(secs => ${windowSec}) else rate_limits.reset_at end
    returning count`);
  if (Math.random() < 0.02) await db.execute(sql`delete from rate_limits where reset_at < now() - interval '1 day'`);
  return Number(row.count);
}

/** True when a counter has reached `limit` (and hasn't reset yet). Doesn't count this check. */
export async function isLimited(key: string, limit: number): Promise<boolean> {
  const [row] = await requireDb().execute<{ count: number }>(sql`select count from rate_limits where key = ${key} and reset_at > now()`);
  return !!row && Number(row.count) >= limit;
}

/** Counts this request and refuses it (429) once there were more than `limit` within the window. */
export async function take(key: string, limit: number, windowSec: number, message: string) {
  if ((await bump(key, windowSec)) > limit) throw new BookingError(message, 429);
}

const CODE_TRIES = 8;
const CODE_TRIES_PER_IP = 30;
const HOUR = 3600;

/**
 * Wraps lookups that need a phone + booking code (see / cancel / rate a booking): after a few wrong codes for
 * the same booking, or many from one visitor, further tries are refused for an hour. Codes are 4 characters,
 * so without this they could be guessed.
 */
export async function guardBookingCode<T>(h: Headers, slug: string, phone: string, fn: () => Promise<T>): Promise<T> {
  const who = `code-ip:${clientKey(h)}`;
  const target = `code:${slug}:${phone.replace(/\D/g, "").slice(-10)}`;
  const tooMany = "Too many wrong tries. Please wait an hour, or ask the driver to look up your booking.";
  if ((await isLimited(who, CODE_TRIES_PER_IP)) || (await isLimited(target, CODE_TRIES))) throw new BookingError(tooMany, 429);
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BookingError && err.status === 404) await Promise.all([bump(who, HOUR), bump(target, HOUR)]);
    throw err;
  }
}
