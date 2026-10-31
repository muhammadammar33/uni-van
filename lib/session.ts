import { jwtVerify, SignJWT } from "jose";

/** Edge-safe session helpers (used by proxy.ts and server code). */
export const SESSION_COOKIE = "van_admin";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { sub: string; email: string; name: string };

/** The admin-session key: derived from AUTH_SECRET but different from every other token's key. */
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(`admin-session:${secret}`);
}

export async function signSession(payload: SessionPayload) {
  const k = key();
  if (!k) throw new Error("AUTH_SECRET must be set (32+ characters) to use the admin dashboard");
  return new SignJWT({ typ: "admin", email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(k);
}

/** A valid admin session (only admin-session tokens count, never another kind), with when it was issued. */
export async function verifySession(token: string | undefined): Promise<(SessionPayload & { iat: number }) | null> {
  const k = key();
  if (!token || !k) return null;
  try {
    const { payload } = await jwtVerify(token, k, { algorithms: ["HS256"] });
    if (payload.typ !== "admin" || !payload.sub || !/^\d{1,9}$/.test(payload.sub)) return null;
    return { sub: payload.sub, email: String(payload.email ?? ""), name: String(payload.name ?? ""), iat: Number(payload.iat ?? 0) };
  } catch {
    return null;
  }
}
