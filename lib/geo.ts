/** Small geometry helpers for matching a rider's pickup / drop-off against a ride's route. */
export type LatLng = { lat: number; lng: number };

const R = 6371; // km

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Where a point falls along a route: distance from it (km) and position (segment index + fraction). */
export function projectOnRoute(route: LatLng[], p: LatLng): { distance: number; position: number } {
  if (route.length === 1) return { distance: distanceKm(route[0], p), position: 0 };
  let best = { distance: Infinity, position: 0 };
  // Equirectangular projection around the point: fine at city scale.
  const kx = Math.cos((p.lat * Math.PI) / 180) * 111.32;
  const ky = 110.57;
  for (let i = 0; i < route.length - 1; i++) {
    const ax = (route[i].lng - p.lng) * kx;
    const ay = (route[i].lat - p.lat) * ky;
    const bx = (route[i + 1].lng - p.lng) * kx;
    const by = (route[i + 1].lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best.distance) best = { distance: d, position: i + t };
  }
  return best;
}

export type RouteMatch = { pickupKm: number; dropKm: number; pickupPos: number; dropPos: number };

/**
 * Does a ride along `route` suit someone going from `from` to `to`? Both must be within `radiusKm` of the route,
 * and the pickup must come before the drop-off in the driving direction.
 */
export function matchRoute(route: LatLng[], from: LatLng, to: LatLng, radiusKm = 3): RouteMatch | null {
  const a = projectOnRoute(route, from);
  const b = projectOnRoute(route, to);
  if (a.distance > radiusKm || b.distance > radiusKm) return null;
  if (b.position <= a.position) return null;
  return { pickupKm: a.distance, dropKm: b.distance, pickupPos: a.position, dropPos: b.position };
}

/** Index of the route point closest to p. */
export function nearestIndex(route: LatLng[], p: LatLng): number {
  let best = 0;
  route.forEach((q, i) => {
    if (distanceKm(q, p) < distanceKm(route[best], p)) best = i;
  });
  return best;
}

/** Rounded position (about 300 m) for showing someone on a public map without pinpointing them. */
export function blur(p: LatLng): LatLng {
  return { lat: Math.round(p.lat / 0.003) * 0.003, lng: Math.round(p.lng / 0.003) * 0.003 };
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${km.toFixed(1)} km`;
}

/**
 * For rides between cities: the rider's pickup and drop-off must each be within `radiusKm` of one of the
 * ride's stops (not anywhere along the road between two cities), pickup stop first.
 */
export function matchStops(route: LatLng[], from: LatLng, to: LatLng, radiusKm = 25): RouteMatch | null {
  const a = nearestIndex(route, from);
  const b = nearestIndex(route, to);
  const pickupKm = distanceKm(route[a], from);
  const dropKm = distanceKm(route[b], to);
  if (pickupKm > radiusKm || dropKm > radiusKm || b <= a) return null;
  return { pickupKm, dropKm, pickupPos: a, dropPos: b };
}
