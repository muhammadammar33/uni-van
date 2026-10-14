import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = canonicalUrl();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/offer`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/feedback`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
