import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";

/**
 * Google sign-in for the Hamsafar app. Google doesn't allow signing in inside an app's web view, so the app opens
 * sign-in in the phone's browser tab; when it's done, the site hands the app a one-time code through the app's
 * own link scheme. The code only works with the secret the app made when it started (like PKCE), so another app
 * that registered the same scheme can't use an intercepted code.
 */
export const APP_SCHEME = "website.hamsafar.app";
const CODE_TTL_MS = 2 * 60 * 1000;

const sha256 = (v: string) => createHash("sha256").update(v).digest("base64url");
/** The app's challenge: base64url SHA-256 of its secret (43 characters). */
export const validChallenge = (c: unknown): c is string => typeof c === "string" && /^[A-Za-z0-9_-]{43}$/.test(c);

/** After Google: a one-time code for the app, kept only as a hash. */
export async function createAppSignIn(userId: number, challenge: string, next: string) {
  const code = randomBytes(32).toString("base64url");
  const db = requireDb();
  await db.insert(s.appSignIns).values({ codeHash: sha256(code), userId, challenge, next, expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  if (Math.random() < 0.1) await db.delete(s.appSignIns).where(lt(s.appSignIns.expiresAt, new Date()));
  return code;
}

/** In the app: the code and the app's secret → who signed in. Single use: the code is gone after one try. */
export async function redeemAppSignIn(code: unknown, verifier: unknown): Promise<{ userId: number; next: string } | null> {
  if (typeof code !== "string" || typeof verifier !== "string" || code.length > 100 || verifier.length < 32 || verifier.length > 128) return null;
  const [row] = await requireDb()
    .delete(s.appSignIns)
    .where(and(eq(s.appSignIns.codeHash, sha256(code)), gt(s.appSignIns.expiresAt, new Date())))
    .returning();
  if (!row) return null;
  const a = Buffer.from(sha256(verifier));
  const b = Buffer.from(row.challenge);
  return a.length === b.length && timingSafeEqual(a, b) ? { userId: row.userId, next: row.next } : null;
}

/** The app adds this to its browser's user agent ("… HamsafarApp/1.0"). */
export const isAppUserAgent = (ua: string | null) => !!ua && /\bHamsafarApp\/\d/.test(ua);
