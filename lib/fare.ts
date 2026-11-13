import { distanceKm, type LatLng } from "./geo";

/**
 * Hamsafar fares share the driver's fuel cost; they aren't a fee for a service. The form suggests a fare per seat
 * from the route's road distance, today's petrol price and the driver's own car's fuel average, and a fare can't be
 * more than half again above that. Riders pay for the part of the route they travel: the fare for the whole route
 * times their share of its distance. Keeping fares at cost-sharing level keeps Hamsafar a carpool, not a
 * ride-hailing service, and keeps seats cheaper than riding alone.
 *
 * The petrol price comes from OGRA's notice (lib/petrol.ts); NEXT_PUBLIC_PETROL_PRICE (PKR a litre) is only the
 * fallback until the first price is in.
 */
export const PETROL_PRICE = Math.max(100, Number(process.env.NEXT_PUBLIC_PETROL_PRICE) || 340);
/** A typical small car in city driving, when the driver hasn't said. */
export const DEFAULT_KM_PER_LITRE = 12;
/** What drivers can enter for their car's average (km a litre). */
export const KMPL_MIN = 5;
export const KMPL_MAX = 30;
/** The fuel is shared between the driver and, on average, a few riders. */
const SHARED_BY = 3.5;
/** Roads are longer than a straight line between stops (only when the road distance isn't known). */
const ROAD_FACTOR = 1.3;
/** The highest fare allowed, as a multiple of the suggested one. */
export const MAX_FACTOR = 1.5;
/** The lowest fare for part of a route (a short hop still costs the driver a stop). */
export const MIN_PART_FARE = 50;

const roundTo10 = (n: number) => Math.round(n / 10) * 10;
const kmplOf = (k: number | null | undefined) => (k && k >= KMPL_MIN && k <= KMPL_MAX ? k : DEFAULT_KM_PER_LITRE);

/** Approximate road distance along the stops, in km, when the road route isn't known. */
export function straightLegs(points: LatLng[]) {
  return points.slice(1).map((p, i) => distanceKm(points[i], p) * ROAD_FACTOR);
}

/** Suggested and highest fare per seat for the whole route (whole rupees, multiples of 10). */
export function fareGuide(km: number, petrolPrice = PETROL_PRICE, kmPerLitre: number | null = DEFAULT_KM_PER_LITRE) {
  const perSeatKm = petrolPrice / kmplOf(kmPerLitre) / SHARED_BY;
  const suggested = Math.max(50, roundTo10(km * perSeatKm));
  const max = Math.max(100, Math.ceil((suggested * MAX_FACTOR) / 10) * 10);
  return { km: Math.round(km), perSeatKm: Math.round(perSeatKm * 10) / 10, suggested, max };
}

/**
 * A rider's fare per seat from stop `from` to stop `to`: the whole-route fare times their share of the distance,
 * rounded to Rs. 10, at least MIN_PART_FARE and never more than the whole-route fare. `legKm[i]` is the distance
 * from stop i to stop i+1. Free rides (0 / null) stay free.
 */
export function partFare(fare: number | null, legKm: number[], from: number, to: number): number | null {
  if (fare === null || fare <= 0) return fare;
  const total = legKm.reduce((a, b) => a + b, 0);
  if (!(total > 0) || from <= 0 && to >= legKm.length) return fare;
  const part = legKm.slice(Math.max(0, from), Math.min(legKm.length, to)).reduce((a, b) => a + b, 0);
  return Math.min(fare, Math.max(Math.min(MIN_PART_FARE, fare), roundTo10((fare * part) / total)));
}
