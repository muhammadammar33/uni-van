import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { USER_COOKIE } from "@/lib/userSession";

/** Sign out (a form POST, so a link on another site can't sign people out). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete({ name: USER_COOKIE, path: "/" });
  return res;
}
