import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { requireDb, schema as s } from "@/lib/db";
import { displayPhone, normalizePhone } from "@/lib/format";
import { clientKey, take } from "@/lib/rateLimit";
import { BookingError } from "@/lib/trips";
import { sendCode, sendText, waConfig } from "@/lib/whatsapp";

/** How phone numbers are checked on this deployment (null = not set up, so numbers aren't checked). */
export type VerifyMode = { send: boolean; message: boolean } | null;

export function verifyMode(): VerifyMode {
  if (process.env.PHONE_VERIFICATION === "off") return null;
  const c = waConfig();
  return c.canSend || c.canReceive ? { send: c.canSend, message: c.canReceive } : null;
}

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const TOKEN_DAYS = 90;

const hash = (id: string, code: string) => createHash("sha256").update(`${process.env.AUTH_SECRET ?? ""}:${id}:${code}`).digest("hex");
const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(secret);
};

/** Proof that this browser verified a phone number; kept by the browser for 90 days. */
async function phoneToken(phone: string) {
  return new SignJWT({ typ: "phone" }).setProtectedHeader({ alg: "HS256" }).setSubject(phone).setIssuedAt().setExpirationTime(`${TOKEN_DAYS}d`).sign(key());
}

/** Throws (403) unless `token` proves `phone` was verified. Does nothing when verification isn't set up. */
export async function requireVerifiedPhone(token: unknown, phoneRaw: unknown) {
  if (!verifyMode()) return;
  const phone = normalizePhone(String(phoneRaw ?? ""));
  const fail = () => {
    throw new BookingError("Please verify your WhatsApp number first.", 403);
  };
  if (!phone || typeof token !== "string" || !token) return fail();
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "phone" || payload.sub !== phone) fail();
  } catch (err) {
    if (err instanceof BookingError) throw err;
    fail();
  }
}

/** Starts a check: sends a code ("send"), or returns one for the person to send us ("message"). */
export async function startVerification(phoneRaw: unknown, methodRaw: unknown, h: Headers) {
  const mode = verifyMode();
  if (!mode) return { required: false as const };
  const phone = normalizePhone(String(phoneRaw ?? ""));
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");
  const method = methodRaw === "message" && mode.message ? "message" : mode.send ? "send" : "message";
  await take(`verify-ip:${clientKey(h)}`, 15, 3600, "Too many verification requests. Please try again in an hour.");
  await take(`verify-phone:${phone}`, 5, 3600, "Too many codes for this number. Please try again in an hour.");
  const id = randomBytes(18).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await requireDb()
    .insert(s.phoneVerifications)
    .values({ id, phone, method, codeHash: hash(id, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) });
  if (method === "send") {
    try {
      await sendCode(phone, code);
    } catch {
      throw new BookingError("We couldn't send a WhatsApp code to that number. Check it's on WhatsApp and try again.", 502);
    }
    return { required: true as const, id, method, phone: displayPhone(phone) };
  }
  const text = `Hamsafar code ${code}`;
  return { required: true as const, id, method, phone: displayPhone(phone), text, link: `https://wa.me/${waConfig().businessNumber}?text=${encodeURIComponent(text)}` };
}

/** Checks a typed code. Five wrong tries and the code is dead. */
export async function checkCode(idRaw: unknown, codeRaw: unknown) {
  const id = String(idRaw ?? "");
  const code = String(codeRaw ?? "").replace(/\D/g, "");
  const db = requireDb();
  const [row] = await db.select().from(s.phoneVerifications).where(eq(s.phoneVerifications.id, id));
  if (!row || row.method !== "send" || row.expiresAt < new Date()) throw new BookingError("This code has expired. Ask for a new one.", 410);
  if (row.attempts >= MAX_ATTEMPTS) throw new BookingError("Too many wrong tries. Ask for a new code.", 429);
  if (row.verifiedAt) return { token: await phoneToken(row.phone) };
  if (hash(id, code) !== row.codeHash) {
    await db.update(s.phoneVerifications).set({ attempts: sql`${s.phoneVerifications.attempts} + 1` }).where(eq(s.phoneVerifications.id, id));
    throw new BookingError(row.attempts + 1 >= MAX_ATTEMPTS ? "Too many wrong tries. Ask for a new code." : "That code isn't right. Check WhatsApp and try again.", 400);
  }
  await db.update(s.phoneVerifications).set({ verifiedAt: new Date() }).where(eq(s.phoneVerifications.id, id));
  return { token: await phoneToken(row.phone) };
}

/** For "message" checks: has the person's WhatsApp arrived yet? */
export async function verificationStatus(idRaw: unknown) {
  const [row] = await requireDb()
    .select()
    .from(s.phoneVerifications)
    .where(eq(s.phoneVerifications.id, String(idRaw ?? "")));
  if (!row) throw new BookingError("Not found", 404);
  if (row.verifiedAt) return { verified: true, token: await phoneToken(row.phone) };
  return { verified: false, expired: row.expiresAt < new Date() };
}

/** A WhatsApp message reached the webhook: if it carries a pending code from the same number, that number is verified. */
export async function receivedMessage(from: string, text: string) {
  const phone = normalizePhone(from);
  const code = text.match(/\b(\d{6})\b/)?.[1];
  if (!phone || !code) return false;
  const db = requireDb();
  const pending = await db
    .select()
    .from(s.phoneVerifications)
    .where(and(eq(s.phoneVerifications.phone, phone), eq(s.phoneVerifications.method, "message"), isNull(s.phoneVerifications.verifiedAt), gt(s.phoneVerifications.expiresAt, new Date())));
  const match = pending.find((p) => hash(p.id, code) === p.codeHash);
  if (!match) return false;
  await db.update(s.phoneVerifications).set({ verifiedAt: new Date() }).where(eq(s.phoneVerifications.id, match.id));
  await sendText(phone, "✅ Your number is verified. Go back to Hamsafar to continue.").catch(() => {});
  if (Math.random() < 0.05) await db.execute(sql`delete from phone_verifications where expires_at < now() - interval '1 day'`);
  return true;
}
