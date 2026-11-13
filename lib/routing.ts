import { distanceKm, type LatLng } from "./geo";
import { decodePolyline, encodePolyline } from "./polyline";

/**
 * The road route through a ride's stops: total and per-leg distance in km, and the line along the roads
 * (encoded polyline). Uses OpenRouteService when ORS_API_KEY is set, otherwise the public OSRM server; if neither
 * answers, falls back to straight lines between the stops × 1.3 (roads are longer than a straight line).
 */
export type RoadRoute = { km: number; legKm: number[]; line: string | null; source: "ors" | "osrm" | "straight" };

const TIMEOUT_MS = 6000;
const ROAD_FACTOR = 1.3;
const r1 = (n: number) => Math.round(n * 10) / 10;

export function straightRoute(points: LatLng[]): RoadRoute {
  const legKm = points.slice(1).map((p, i) => r1(distanceKm(points[i], p) * ROAD_FACTOR));
  return { km: r1(legKm.reduce((a, b) => a + b, 0)), legKm, line: null, source: "straight" };
}

/** Thins a long line so it stays small in the database and pages (about every 30 m at most, kept shape). */
function thin(line: LatLng[], maxPoints = 600) {
  if (line.length <= maxPoints) return line;
  const step = line.length / maxPoints;
  const out: LatLng[] = [];
  for (let i = 0; i < line.length; i += step) out.push(line[Math.floor(i)]);
  out.push(line[line.length - 1]);
  return out;
}

async function viaOrs(points: LatLng[], key: string): Promise<RoadRoute | null> {
  const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: { authorization: key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), instructions: false }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { routes?: { summary: { distance: number }; segments?: { distance: number }[]; geometry: string }[] };
  const r = j.routes?.[0];
  if (!r?.segments || r.segments.length !== points.length - 1) return null;
  return { km: r1(r.summary.distance / 1000), legKm: r.segments.map((s) => r1(s.distance / 1000)), line: encodePolyline(thin(decodePolyline(r.geometry))), source: "ors" };
}

async function viaOsrm(points: LatLng[]): Promise<RoadRoute | null> {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const base = process.env.OSRM_URL || "https://router.project-osrm.org";
  const res = await fetch(`${base}/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=false`, {
    headers: { "user-agent": "Hamsafar carpool (hamsafar.website)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { code: string; routes?: { distance: number; geometry: string; legs: { distance: number }[] }[] };
  const r = j.routes?.[0];
  if (j.code !== "Ok" || !r || r.legs.length !== points.length - 1) return null;
  return { km: r1(r.distance / 1000), legKm: r.legs.map((l) => r1(l.distance / 1000)), line: encodePolyline(thin(decodePolyline(r.geometry))), source: "osrm" };
}

export async function roadRoute(points: LatLng[]): Promise<RoadRoute> {
  if (points.length < 2) return straightRoute(points);
  const key = process.env.ORS_API_KEY;
  for (const get of [key ? () => viaOrs(points, key) : null, () => viaOsrm(points)]) {
    if (!get) continue;
    try {
      const r = await get();
      // A road route far longer than the straight line usually means a stop snapped to the wrong road.
      if (r && r.km > 0 && r.legKm.every((k, i) => k <= distanceKm(points[i], points[i + 1]) * 4 + 3)) return r;
    } catch {
      /* try the next one */
    }
  }
  return straightRoute(points);
}
