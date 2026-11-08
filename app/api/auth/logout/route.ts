import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { USER_COOKIE } from "@/lib/userSession";
import { forgetDevice } from "@/lib/push";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/account";

/** Sign out (a form POST, so a link on another site can't sign people out). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  // Signing out in the app: this phone stops getting that person's notifications.
  const device = (await cookies()).get("hs_push")?.value;
  const user = device ? await currentUser() : null;
  if (device && user) await forgetDevice(device, user.id).catch(() => {});
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete({ name: "hs_push", path: "/" });
  res.cookies.delete({ name: USER_COOKIE, path: "/" });
  return res;
}
