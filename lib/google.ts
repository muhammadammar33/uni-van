import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Google sign-in (OpenID Connect, authorization code with PKCE). The *_URL settings only exist so tests can
 * stand in for Google; on the real site they're unset.
 */
const env = (k: string) => process.env[k]?.trim() || "";
const AUTH_URL = () => env("GOOGLE_AUTH_URL") || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => env("GOOGLE_TOKEN_URL") || "https://oauth2.googleapis.com/token";
const ISSUERS = () => (env("GOOGLE_ISSUER") ? [env("GOOGLE_ISSUER")] : ["https://accounts.google.com", "accounts.google.com"]);
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const keys = () => (jwks ??= createRemoteJWKSet(new URL(env("GOOGLE_JWKS_URL") || "https://www.googleapis.com/oauth2/v3/certs")));

const b64url = (b: Buffer) => b.toString("base64url");

export function newSignIn() {
  const verifier = b64url(randomBytes(32));
  return { state: b64url(randomBytes(16)), nonce: b64url(randomBytes(16)), verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export const callbackUrl = (origin: string) => `${origin}/api/auth/google/callback`;

export function authorizeUrl(origin: string, p: { state: string; nonce: string; challenge: string }) {
  const q = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL()}?${q}`;
}

export type GoogleProfile = { sub: string; email: string; name: string; picture: string | null };

/** Exchanges the code Google sent back, and checks the signed ID token: issuer, audience, expiry, nonce, verified email. */
export async function finishSignIn(origin: string, code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!res.ok || !j.id_token) throw new Error(j.error_description ?? j.error ?? `Google said ${res.status}`);
  const { payload } = await jwtVerify(j.id_token, keys(), { issuer: ISSUERS(), audience: env("GOOGLE_CLIENT_ID") });
  if (payload.nonce !== nonce) throw new Error("Sign-in didn't match. Please try again.");
  if (!payload.sub || typeof payload.email !== "string" || payload.email_verified !== true) throw new Error("Your Google account's email isn't verified.");
  return {
    sub: payload.sub,
    email: payload.email,
    name: (typeof payload.name === "string" && payload.name.trim()) || payload.email.split("@")[0],
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
