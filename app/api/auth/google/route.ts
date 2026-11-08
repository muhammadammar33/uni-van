import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/account";
import { authorizeUrl, newSignIn } from "@/lib/google";
import { OAUTH_COOKIE, safeNext, signOAuthState } from "@/lib/userSession";
import { validChallenge } from "@/lib/appSignIn";

export const dynamic = "force-dynamic";

/** "Continue with Google": off to Google, remembering where to come back to (?next=/path). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNext(url.searchParams.get("next"));
  if (!authEnabled()) return NextResponse.redirect(new URL(next, url.origin));
  // Started by the Hamsafar app (in the phone's browser tab): remember its challenge for the hand-back.
  const app = url.searchParams.get("app");
  const s = newSignIn();
  const res = NextResponse.redirect(authorizeUrl(url.origin, s));
  res.cookies.set(OAUTH_COOKIE, await signOAuthState({ state: s.state, verifier: s.verifier, nonce: s.nonce, next, ...(validChallenge(app) ? { app } : {}) }), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  res.headers.set("cache-control", "no-store");
  return res;
}
