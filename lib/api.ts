import "server-only";
import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { BookingError } from "@/lib/trips";

/** API answers often carry phone numbers, booking codes or names: never kept in a (shared) browser's cache. */
const NO_STORE = { "cache-control": "private, no-store" };

/** Logs an error without its details: database errors carry the query's values (names, CNICs, phone numbers). */
export function logError(label: string, err: unknown) {
  const e = err as { name?: string; code?: string; statusCode?: number; cause?: { code?: string; message?: string } } | null;
  const cause = String(e?.cause?.message ?? "").slice(0, 120).replace(/\d{6,}/g, (d) => `…${d.slice(-3)}`);
  console.error(`${label}:`, e?.name ?? "Error", e?.code ?? e?.statusCode ?? e?.cause?.code ?? "", cause);
}

/**
 * Public data that's the same for everyone (a ride's seats, the live map) can be shared from Vercel's cache for
 * a few seconds: then a thousand open pages cost about one server run every few seconds, not a thousand.
 * Browsers themselves always ask again.
 */
const sharedFor = (seconds: number) => ({
  "cache-control": "public, max-age=0, must-revalidate",
  "vercel-cdn-cache-control": `max-age=${seconds}, stale-while-revalidate=${seconds * 2}`,
});

/**
 * Runs a route handler body, turning BookingErrors into `{ error }` JSON with their status. `sharedCacheSeconds`:
 * only for answers with nothing personal in them (see sharedFor); errors are never cached.
 */
export async function handle(fn: () => Promise<unknown>, opts: { sharedCacheSeconds?: number } = {}) {
  try {
    return NextResponse.json(await fn(), { headers: opts.sharedCacheSeconds ? sharedFor(opts.sharedCacheSeconds) : NO_STORE });
  } catch (err) {
    if (err instanceof BookingError) return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status, headers: NO_STORE });
    logError("request failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** A scheduled job's call (Vercel Cron, the petrol job): `Authorization: Bearer <CRON_SECRET>`, compared in
 * constant time. Without CRON_SECRET set, nothing is allowed. */
export function cronAllowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(req.headers.get("authorization") ?? ""), h(`Bearer ${secret}`));
}

/** Largest request body accepted (ID photos are the biggest: a few compressed pictures). */
const MAX_BODY = 8 * 1024 * 1024;

/**
 * Refuses requests made by another website on a visitor's behalf (cross-site request forgery): browsers say
 * where a request comes from, and it must be this site. Requests with neither header (apps, scripts) carry
 * no browser cookies to abuse, so they're judged by the usual checks.
 */
export function assertSameOrigin(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new BookingError("This request has to come from Hamsafar itself.", 403);
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) throw new BookingError("This request has to come from Hamsafar itself.", 403);
}

/** Reads a JSON body (an empty object if it isn't JSON), from this site only and within the size limit. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  assertSameOrigin(req);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) throw new BookingError("That's too much data to send at once.", 413);
  let text: string;
  try {
    text = await req.text();
  } catch {
    return {};
  }
  if (text.length > MAX_BODY) throw new BookingError("That's too much data to send at once.", 413);
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}
