import "server-only";
import { after } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { importPKCS8, SignJWT } from "jose";
import { requireDb, schema as s } from "@/lib/db";
import { logError } from "@/lib/api";

/**
 * Push notifications to the Hamsafar app (Firebase Cloud Messaging, HTTP v1). Needs FIREBASE_SERVICE_ACCOUNT:
 * the service account key JSON from Firebase → Project settings → Service accounts (set in Vercel, never in
 * the code). Without it, nothing is sent and nothing breaks.
 */
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
const TOKEN_URL = () => process.env.FCM_TOKEN_URL || "https://oauth2.googleapis.com/token";
const SEND_BASE = () => process.env.FCM_SEND_BASE || "https://fcm.googleapis.com";

function account(): ServiceAccount | null {
  try {
    const a = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
    return a?.project_id && a?.client_email && a?.private_key ? a : null;
  } catch {
    return null;
  }
}
export const pushEnabled = () => !!account();

let cached: { token: string; until: number } | null = null;
async function accessToken(a: ServiceAccount) {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const key = await importPKCS8(a.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(a.client_email)
    .setAudience(TOKEN_URL())
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`Firebase sign-in failed: ${j.error ?? res.status}`);
  cached = { token: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** A phone of a signed-in person with the app (token from the app's push registration). */
export async function saveDevice(userId: number, token: string, platform: "android" | "ios") {
  await requireDb()
    .insert(s.deviceTokens)
    .values({ userId, token, platform })
    .onConflictDoUpdate({ target: s.deviceTokens.token, set: { userId, platform, lastSeenAt: new Date() } });
}
export async function forgetDevice(token: string, userId?: number) {
  await requireDb()
    .delete(s.deviceTokens)
    .where(userId ? and(eq(s.deviceTokens.token, token), eq(s.deviceTokens.userId, userId)) : eq(s.deviceTokens.token, token));
}

/** `tag`: a newer notification with the same tag replaces the older one (e.g. one per chat). */
export type PushMessage = { title: string; body: string; url: string; tag?: string };

/** Sends to every app the people with these numbers are signed in to. Returns how many phones got it. */
export async function pushToPhones(phones: string[], msg: PushMessage): Promise<number> {
  const a = account();
  const list = [...new Set(phones.filter(Boolean))];
  if (!a || !list.length) return 0;
  const db = requireDb();
  const devices = await db
    .select({ token: s.deviceTokens.token })
    .from(s.deviceTokens)
    .innerJoin(s.users, eq(s.users.id, s.deviceTokens.userId))
    .where(inArray(s.users.phone, list));
  if (!devices.length) return 0;
  const bearer = await accessToken(a);
  let sent = 0;
  await Promise.all(
    devices.map(async ({ token }) => {
      const res = await fetch(`${SEND_BASE()}/v1/projects/${a.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title.slice(0, 100), body: msg.body.slice(0, 300) },
            data: { url: msg.url },
            android: { priority: "high", notification: { channel_id: "rides", color: "#0f766e", icon: "ic_stat_hamsafar", ...(msg.tag ? { tag: msg.tag } : {}) } },
          },
        }),
      });
      if (res.ok) return sent++;
      const j = (await res.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
      // The app was uninstalled or the token replaced: forget it.
      const code = j.error?.details?.find((d) => d.errorCode)?.errorCode ?? j.error?.status;
      if (res.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT") await forgetDevice(token);
      else logError("push", { name: "FCM", code: code ?? String(res.status) });
    }),
  );
  return sent;
}

/** Sends after the response (never slows down or breaks the action that triggered it). */
export function pushLater(phones: string[], msg: PushMessage) {
  if (!pushEnabled()) return;
  const run = () => pushToPhones(phones, msg).catch((err) => logError("push", err));
  try {
    after(run);
  } catch {
    void run();
  }
}
