import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { upsertGoogleUser } from "@/lib/account";
import { finishSignIn } from "@/lib/google";
import { OAUTH_COOKIE, readOAuthState, signUserSession, USER_COOKIE, USER_TTL } from "@/lib/userSession";

export const dynamic = "force-dynamic";

/** Google sends the person back here: check it's the sign-in we started, then start their session. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const saved = await readOAuthState(jar.get(OAUTH_COOKIE)?.value);
  const fail = (why: string) => {
    const r = NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(why)}&next=${encodeURIComponent(saved?.next ?? "/")}`, url.origin));
    r.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return r;
  };
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error") === "access_denied" ? "You cancelled the Google sign-in." : "Google sign-in didn't work. Please try again.");
  const code = url.searchParams.get("code");
  if (!saved || !code || url.searchParams.get("state") !== saved.state) return fail("That sign-in link expired. Please try again.");
  try {
    const profile = await finishSignIn(url.origin, code, saved.verifier, saved.nonce);
    const id = await upsertGoogleUser(profile);
    if (!id) return fail("This account can't use Hamsafar. Contact us through Feedback if you think it's a mistake.");
    const res = NextResponse.redirect(new URL(saved.next, url.origin));
    res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    res.cookies.set(USER_COOKIE, await signUserSession(id), { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: USER_TTL });
    res.headers.set("cache-control", "no-store");
    return res;
  } catch (err) {
    console.error("google sign-in", err);
    return fail("Google sign-in didn't work. Please try again.");
  }
}
