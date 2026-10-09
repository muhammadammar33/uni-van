import { jwtVerify, SignJWT } from "jose";

/** Edge-safe session helpers (used by proxy.ts and server code). */
export const SESSION_COOKIE = "van_admin";
export const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = { sub: string; email: string; name: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  const k = key();
  if (!k) throw new Error("AUTH_SECRET must be set (32+ characters) to use the admin dashboard");
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(k);
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  const k = key();
  if (!token || !k) return null;
  try {
    const { payload } = await jwtVerify(token, k, { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, email: String(payload.email ?? ""), name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
