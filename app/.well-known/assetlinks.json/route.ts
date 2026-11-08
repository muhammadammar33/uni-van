/**
 * Android App Links: lets hamsafar.website links open in the Hamsafar app. Lists the app's signing certificate
 * fingerprints (SHA-256, from Google Play → App integrity), set in ANDROID_CERT_SHA256 (comma-separated).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  const body = fingerprints.length
    ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "website.hamsafar.app", sha256_cert_fingerprints: fingerprints } }]
    : [];
  return Response.json(body, { headers: { "cache-control": "public, max-age=3600" } });
}
