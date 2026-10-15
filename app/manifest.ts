import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Lets phones add Hamsafar to the home screen with its own icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name}: carpool in Islamabad, Rawalpindi & across Pakistan`,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
