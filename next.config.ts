import type { NextConfig } from "next";

/** Browser protections for every page and API response. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Nobody may show the site inside a frame on their own page (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
];

/** The site's CSP. Not sent with admin media / ID photo files: those set their own stricter, sandboxed one,
 * and Next keeps a header set here in place of the route's own. */
const csp = [
  // What pages may load: only this site, plus the map tiles (OpenStreetMap), place names for dropped pins
  // (Nominatim) and Google profile pictures. 'wasm-unsafe-eval' and blob: workers are for the ID card reader.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.googleusercontent.com",
      "connect-src 'self' https://nominatim.openstreetmap.org",
      "worker-src 'self' blob:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "manifest-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const otherHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location and camera (ID photos) are used by the site itself; microphone and payments never.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // The PDF reader (OGRA petrol price notices) loads its own pdf.js files: keep it out of the bundle.
  serverExternalPackages: ["unpdf"],
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the repo.
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...otherHeaders] },
      { source: "/:path((?!api/admin/(?:wa-media|id-docs)/).*)", headers: csp },
      // The ID card reader's files: versioned folder, so they can be cached for good.
      { source: "/ocr/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
