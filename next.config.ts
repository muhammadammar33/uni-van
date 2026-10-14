import type { NextConfig } from "next";

/** Browser protections for every page and API response. */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Nobody may show the site inside a frame on their own page (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Location is used by the site itself; camera, microphone and payments never.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // Don't let `next dev` write AGENTS.md / CLAUDE.md into the repo.
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
