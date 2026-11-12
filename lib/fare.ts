import { distanceKm, type LatLng } from "./geo";

/**
 * Hamsafar fares share the driver's fuel cost; they aren't a fee for a service. The form suggests a fare per seat
 * from the route's length and today's petrol price, and a fare can't be more than half again above that.
 * Keeping fares at cost-sharing level keeps Hamsafar a carpool, not a ride-hailing service, and keeps seats
 * cheaper than riding alone.
 *
 * NEXT_PUBLIC_PETROL_PRICE: petrol, PKR a litre (update it when the price changes; it's read at build time).
 */
export const PETROL_PRICE = Math.max(100, Number(process.env.NEXT_PUBLIC_PETROL_PRICE) || 340);
/** A typical small car in city and highway driving. */
const KM_PER_LITRE = 12;
/** The fuel is shared between the driver and, on average, a few riders. */
const SHARED_BY = 3.5;
/** Roads are longer than a straight line between stops. */
const ROAD_FACTOR = 1.3;
/** The highest fare allowed, as a multiple of the suggested one. */
export const MAX_FACTOR = 1.5;

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/** Approximate road distance along the route's stops, in km. */
export function routeKm(points: LatLng[]) {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += distanceKm(points[i - 1], points[i]);
  return km * ROAD_FACTOR;
}

/** Suggested and highest fare per seat for a route (whole rupees, multiples of 10). */
export function fareGuide(points: LatLng[]) {
  const km = routeKm(points);
  const perSeatKm = PETROL_PRICE / KM_PER_LITRE / SHARED_BY;
  const suggested = Math.max(50, roundTo10(km * perSeatKm));
  const max = Math.max(100, Math.ceil((suggested * MAX_FACTOR) / 10) * 10);
  return { km: Math.round(km), perSeatKm: Math.round(perSeatKm * 10) / 10, suggested, max };
}
