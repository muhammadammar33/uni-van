import { NextResponse } from "next/server";
import { redeemAppSignIn } from "@/lib/appSignIn";
import { clientKey, take } from "@/lib/rateLimit";
import { BookingError } from "@/lib/trips";
import { signUserSession, USER_COOKIE, USER_TTL } from "@/lib/userSession";

export const dynamic = "force-dynamic";

/** In the Hamsafar app: the one-time code from the sign-in tab + the app's secret → the app is signed in. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (why: string) => NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(why)}`, url.origin));
  try {
    await take(`app-signin:${clientKey(req.headers)}`, 20, 600, "Too many tries");
  } catch (err) {
    if (err instanceof BookingError) return fail("Too many sign-in attempts. Please wait a few minutes.");
    throw err;
  }
  const done = await redeemAppSignIn(url.searchParams.get("code"), url.searchParams.get("verifier"));
  if (!done) return fail("That sign-in expired. Please try again.");
  const res = NextResponse.redirect(new URL(done.next, url.origin));
  res.cookies.set(USER_COOKIE, await signUserSession(done.userId), { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax", path: "/", maxAge: USER_TTL });
  res.headers.set("cache-control", "no-store");
  res.headers.set("referrer-policy", "no-referrer");
  return res;
}
