import { handle } from "@/lib/api";
import { roadRoute } from "@/lib/routing";
import { BookingError } from "@/lib/trips";

/**
 * The road route through some stops, for the ride form's distance, fare suggestion and map:
 * GET /api/route?p=lat,lng;lat,lng;... → { km, legKm, line, source }. The same stops give the same answer, so it's
 * shared from Vercel's cache for a day (only a few minutes when the road route couldn't be worked out).
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("p") ?? "";
  const points = raw.split(";").map((s) => {
    const [lat, lng] = s.split(",").map(Number);
    return { lat, lng };
  });
  const ok = points.length >= 2 && points.length <= 12 && points.every((p) => p.lat >= 23 && p.lat <= 37.5 && p.lng >= 60 && p.lng <= 78);
  if (!ok) return handle(async () => { throw new BookingError("Send 2 to 12 points in Pakistan"); });
  const route = await roadRoute(points);
  return handle(async () => route, { sharedCacheSeconds: route.source === "straight" ? 120 : 86400 });
}
