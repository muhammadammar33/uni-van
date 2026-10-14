import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  const base = canonicalUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/r/manage/", "/d/", "/api/", "/business"] },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
