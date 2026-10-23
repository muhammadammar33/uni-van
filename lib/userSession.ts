import { jwtVerify, SignJWT } from "jose";

/** Signed-in riders and drivers (Google). Separate from the admin session. */
export const USER_COOKIE = "hs_user";
export const USER_TTL = 60 * 60 * 24 * 180; // 180 days
/** Short-lived state for one Google sign-in (state, PKCE verifier, nonce, where to go back to). */
export const OAUTH_COOKIE = "hs_oauth";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(`user:${secret}`);
}

export async function signUserSession(userId: number) {
  return new SignJWT({ typ: "user" }).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId)).setIssuedAt().setExpirationTime(`${USER_TTL}s`).sign(key());
}

export async function readUserSession(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.typ === "user" && payload.sub ? Number(payload.sub) || null : null;
  } catch {
    return null;
  }
}

export type OAuthState = { state: string; verifier: string; nonce: string; next: string };

export async function signOAuthState(s: OAuthState) {
  return new SignJWT({ ...s, typ: "oauth" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(key());
}

export async function readOAuthState(token: string | undefined): Promise<OAuthState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "oauth") return null;
    return { state: String(payload.state), verifier: String(payload.verifier), nonce: String(payload.nonce), next: String(payload.next) };
  } catch {
    return null;
  }
}

/** Only paths on this site (never another site, which would make sign-in an open redirect). */
export function safeNext(next: unknown): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") && !n.startsWith("/api/auth") ? n.slice(0, 500) : "/";
}
