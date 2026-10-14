import { BRAND } from "@/lib/brand";

/**
 * The site's canonical address, for metadata and link previews: SITE_URL if set, else Vercel's production
 * domain (the custom domain once it's added to the project), else the brand domain.
 */
export function canonicalUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `https://${BRAND.domain}`;
}

/** Public address of the site for share links: SITE_URL if set, otherwise the address the admin is using. */
export function siteUrl(h: Headers): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
