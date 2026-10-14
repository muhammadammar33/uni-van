import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { envSiteUrl } from "@/lib/url";

/**
 * 1. On the production deployment, visits to the old *.vercel.app address go to the site's own domain, once
 *    SITE_URL is set (set it only after the domain works, or the redirect would point at a dead address).
 * 2. Optimistic guard for /admin: no valid session cookie, no dashboard. Pages re-check against the DB.
 */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host") ?? "";
  const site = envSiteUrl();
  if (process.env.VERCEL_ENV === "production" && site && !site.includes(".vercel.app") && host.endsWith(".vercel.app"))
    return NextResponse.redirect(`${site}${pathname}${search}`, 308);

  if (!pathname.startsWith("/admin") || pathname === "/admin/login") return NextResponse.next();
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/admin/login", req.url);
    if (pathname !== "/admin") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Everything except API calls and static files (the admin check above only applies to /admin).
export const config = { matcher: ["/((?!api/|_next/|icon|apple-icon|favicon|manifest.webmanifest|opengraph-image|robots.txt|sitemap.xml).*)"] };
