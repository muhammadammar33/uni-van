import { BRAND } from "@/lib/brand";

/**
 * A setting like SITE_URL as a clean origin ("https://hamsafar.website"). Forgives what people type into
 * dashboards: a missing https://, a trailing slash or path, spaces or quotes. Null if it isn't a usable address.
 */
export function toOrigin(raw: string | undefined | null): string | null {
  const v = raw?.trim().replace(/^["'\s]+|["'\s]+$/g, "");
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".") || u.hostname === "localhost" ? u.origin : null;
  } catch {
    return null;
  }
}

/** SITE_URL, if it's set to a usable address. */
export const envSiteUrl = () => toOrigin(process.env.SITE_URL);

/**
 * The site's canonical address, for metadata and link previews: SITE_URL if usable, else Vercel's production
 * domain (the custom domain once it's added to the project), else the brand domain.
 */
export function canonicalUrl(): string {
  return envSiteUrl() ?? toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ?? `https://${BRAND.domain}`;
}

/** Public address of the site for share links: SITE_URL if usable, otherwise the address the admin is using. */
export function siteUrl(h: Headers): string {
  const site = envSiteUrl();
  if (site) return site;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
