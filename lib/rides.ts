import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireDb, schema as s } from "@/lib/db";
import { normalizePhone, nowLocal, todayLocal } from "@/lib/format";
import { blur, distanceKm, matchRoute, type LatLng } from "@/lib/geo";
import { GENDERS } from "@/lib/layout";
import { BookingError } from "@/lib/trips";
import { nextRuns, runOver, runsOn, type Schedule } from "@/lib/schedule";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Choose the departure time");

const pointSchema = z.object({
  name: z.string().trim().min(2, "Every location needs a name").max(80),
  lat: z.number().min(23).max(37.5),
  lng: z.number().min(60).max(78),
  key: z.string().max(40).optional(),
});

export const rideInput = z
  .object({
    driverName: z.string().trim().min(2, "Enter your name").max(60),
    driverPhone: z.string().trim().max(30),
    driverGender: z.enum(GENDERS, "Choose male or female"),
    car: z.string().trim().min(2, "Enter your car, e.g. Suzuki Cultus, white").max(60),
    plate: z.string().trim().max(20).optional().default(""),
    seats: z.coerce.number().int().min(1, "At least 1 seat").max(12, "12 seats at most"),
    fare: z.union([z.literal(""), z.literal(null), z.coerce.number().int().min(0).max(100000)]).optional(),
    riders: z.enum(["anyone", "female", "male"]).default("anyone"),
    departTime: hhmm,
    schedule: z.enum(["once", "daily", "weekly"]),
    date: ymd,
    days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    until: z.union([ymd, z.literal(""), z.literal(null)]).optional(),
    notes: z.string().trim().max(1000).optional().default(""),
    points: z.array(pointSchema).min(2, "Add where the ride starts and ends").max(12, "12 locations at most"),
  })
  .refine((r) => r.schedule !== "weekly" || r.days.length > 0, "Choose the days of the week")
  .refine((r) => !r.until || r.until >= r.date, "The end date can't be before the start");

export type RideInput = z.input<typeof rideInput>;

function readRide(raw: unknown) {
  const parsed = rideInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check the form");
  const r = parsed.data;
  const phone = normalizePhone(r.driverPhone);
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");
  for (let i = 1; i < r.points.length; i++)
    if (distanceKm(r.points[i - 1], r.points[i]) < 0.05) throw new BookingError(`"${r.points[i].name}" is the same place as the one before it`);
  return {
    ride: {
      driverName: r.driverName,
      driverPhone: phone,
      driverGender: r.driverGender,
      car: r.car,
      plate: r.plate || null,
      seats: r.seats,
      fare: r.fare === "" || r.fare === null || r.fare === undefined ? null : r.fare,
      riders: r.riders,
      departTime: r.departTime,
      schedule: r.schedule,
      date: r.date,
      days: r.schedule === "weekly" ? [...new Set(r.days)].sort() : [],
      until: r.schedule === "once" || !r.until ? null : r.until,
      notes: r.notes || null,
    },
    points: r.points,
  };
}

export async function createRide(raw: unknown) {
  const { ride, points } = readRide(raw);
  if (ride.schedule === "once" && ride.date < todayLocal()) throw new BookingError("The date has already passed");
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.rides)
      .values({ ...ride, slug: randomBytes(5).toString("base64url"), manageToken: randomBytes(16).toString("base64url") })
      .returning();
    await tx.insert(s.ridePoints).values(points.map((p, idx) => ({ rideId: row.id, idx, name: p.name, lat: p.lat, lng: p.lng, placeKey: p.key ?? null })));
    return { slug: row.slug, manageToken: row.manageToken };
  });
}

/** Replaces a ride's details and route (only while nobody has booked a future date at a removed stop). */
export async function updateRide(token: string, raw: unknown) {
  const { ride, points } = readRide(raw);
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.rides).where(eq(s.rides.manageToken, token)).for("update");
    if (!row) throw new BookingError("Ride not found", 404);
    const upcoming = await tx
      .select()
      .from(s.rideBookings)
      .where(and(eq(s.rideBookings.rideId, row.id), gte(s.rideBookings.date, todayLocal())));
    if (upcoming.length) {
      const old = await tx.select().from(s.ridePoints).where(eq(s.ridePoints.rideId, row.id)).orderBy(asc(s.ridePoints.idx));
      const same = old.length === points.length && old.every((p, i) => p.name === points[i].name && Math.abs(p.lat - points[i].lat) < 1e-6 && Math.abs(p.lng - points[i].lng) < 1e-6);
      if (!same) throw new BookingError("Riders have booked upcoming days, so the route can't change. Pause this ride and offer a new one instead.");
      const perDay = new Map<string, number>();
      for (const b of upcoming) perDay.set(b.date, (perDay.get(b.date) ?? 0) + b.seats);
      const most = Math.max(...perDay.values());
      if (ride.seats < most) throw new BookingError(`${most} seats are already booked on one day, so you can't offer fewer.`);
    }
    await tx.update(s.rides).set(ride).where(eq(s.rides.id, row.id));
    if (!upcoming.length) {
      await tx.delete(s.ridePoints).where(eq(s.ridePoints.rideId, row.id));
      await tx.insert(s.ridePoints).values(points.map((p, idx) => ({ rideId: row.id, idx, name: p.name, lat: p.lat, lng: p.lng, placeKey: p.key ?? null })));
    }
  });
}

/** Removes a ride with its route, bookings and live position. */
export async function deleteRide(token: string) {
  const deleted = await requireDb().delete(s.rides).where(eq(s.rides.manageToken, token)).returning({ id: s.rides.id });
  if (!deleted.length) throw new BookingError("Ride not found", 404);
}

export async function setRideStatus(token: string, status: s.Ride["status"]) {
  const updated = await requireDb().update(s.rides).set({ status }).where(eq(s.rides.manageToken, token)).returning({ id: s.rides.id });
  if (!updated.length) throw new BookingError("Ride not found", 404);
}

const scheduleOf = (r: s.Ride): Schedule => ({ kind: r.schedule, date: r.date, days: r.days, until: r.until });

/** Days the ride still runs (today's run counts until its departure time). */
export function upcomingRuns(r: s.Ride, n = 7) {
  const now = nowLocal();
  return nextRuns(scheduleOf(r), now.slice(0, 10), n + 1)
    .filter((d) => d > now.slice(0, 10) || r.departTime > now.slice(11))
    .slice(0, n);
}

async function seatsTaken(rideIds: number[], dates: string[]) {
  if (!rideIds.length || !dates.length) return new Map<string, number>();
  const rows = await requireDb()
    .select({ rideId: s.rideBookings.rideId, date: s.rideBookings.date, n: sql<number>`sum(${s.rideBookings.seats})::int` })
    .from(s.rideBookings)
    .where(and(inArray(s.rideBookings.rideId, rideIds), inArray(s.rideBookings.date, dates)))
    .groupBy(s.rideBookings.rideId, s.rideBookings.date);
  return new Map(rows.map((r) => [`${r.rideId}:${r.date}`, r.n]));
}

export type PublicRide = {
  slug: string;
  driverName: string;
  driverGender: s.Ride["driverGender"];
  car: string;
  seats: number;
  fare: number | null;
  riders: s.Ride["riders"];
  departTime: string;
  schedule: Schedule;
  notes: string | null;
  status: s.Ride["status"];
  points: { name: string; lat: number; lng: number }[];
  /** Upcoming run dates with seats left on each. */
  runs: { date: string; left: number }[];
  /** The driver's rating from riders who travelled with them (on any of their rides); null when none yet. */
  rating: DriverRating | null;
  /** Latest reviews, on the ride page only. */
  reviews?: PublicReview[];
};

export type DriverRating = { avg: number; count: number };
export type PublicReview = { name: string; stars: number; comment: string | null; date: string };

function toPublic(r: s.Ride, points: s.RidePoint[], taken: Map<string, number>, runs: string[], ratings: Map<string, DriverRating>): PublicRide {
  return {
    slug: r.slug,
    driverName: r.driverName.split(" ")[0],
    driverGender: r.driverGender,
    car: r.car,
    seats: r.seats,
    fare: r.fare,
    riders: r.riders,
    departTime: r.departTime,
    schedule: scheduleOf(r),
    notes: r.notes,
    status: r.status,
    points: points.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
    runs: runs.map((date) => ({ date, left: Math.max(0, r.seats - (taken.get(`${r.id}:${date}`) ?? 0)) })),
    rating: ratings.get(r.driverPhone) ?? null,
  };
}

/** Average stars per driver phone, leaving out reviews hidden by an admin. */
async function ratingsFor(phones: string[]) {
  if (!phones.length) return new Map<string, DriverRating>();
  const rows = await requireDb()
    .select({ phone: s.driverReviews.driverPhone, avg: sql<number>`avg(${s.driverReviews.stars})::float`, count: sql<number>`count(*)::int` })
    .from(s.driverReviews)
    .where(and(inArray(s.driverReviews.driverPhone, [...new Set(phones)]), eq(s.driverReviews.hidden, false)))
    .groupBy(s.driverReviews.driverPhone);
  return new Map(rows.map((r) => [r.phone, { avg: Math.round(r.avg * 10) / 10, count: r.count }]));
}

async function reviewsFor(phone: string, limit = 6): Promise<PublicReview[]> {
  const rows = await requireDb()
    .select()
    .from(s.driverReviews)
    .where(and(eq(s.driverReviews.driverPhone, phone), eq(s.driverReviews.hidden, false)))
    .orderBy(desc(s.driverReviews.updatedAt))
    .limit(limit);
  return rows.map((r) => ({ name: r.riderName, stars: r.stars, comment: r.comment, date: r.updatedAt.toISOString().slice(0, 10) }));
}

async function pointsFor(rideIds: number[]) {
  if (!rideIds.length) return [];
  return requireDb().select().from(s.ridePoints).where(inArray(s.ridePoints.rideId, rideIds)).orderBy(asc(s.ridePoints.idx));
}

export async function publicRide(slug: string) {
  const [r] = await requireDb().select().from(s.rides).where(eq(s.rides.slug, slug)).limit(1);
  if (!r) return null;
  const runs = r.status === "active" ? upcomingRuns(r, 14) : [];
  const [points, taken, ratings, reviews] = await Promise.all([pointsFor([r.id]), seatsTaken([r.id], runs), ratingsFor([r.driverPhone]), reviewsFor(r.driverPhone)]);
  return { ...toPublic(r, points, taken, runs, ratings), reviews };
}

export type SearchResult = PublicRide & { pickupKm: number; dropKm: number; pickupIdx: number; dropIdx: number };

/** Active rides passing near `from` and then `to`, running on `date` (or any of the next 7 days when null). */
export async function searchRides(from: LatLng | null, to: LatLng | null, date: string | null) {
  const db = requireDb();
  const today = todayLocal();
  const rows = await db
    .select()
    .from(s.rides)
    .where(and(eq(s.rides.status, "active"), sql`((${s.rides.schedule} <> 'once' and (${s.rides.until} is null or ${s.rides.until} >= ${today})) or ${s.rides.date} >= ${today})`))
    .limit(500);
  const active = rows.filter((r) => r.status === "active");
  const points = await pointsFor(active.map((r) => r.id));
  const out: { ride: s.Ride; pts: s.RidePoint[]; match: ReturnType<typeof matchRoute>; runs: string[] }[] = [];
  for (const r of active) {
    const pts = points.filter((p) => p.rideId === r.id);
    if (pts.length < 2) continue;
    let match: ReturnType<typeof matchRoute> = null;
    if (from && to) {
      match = matchRoute(pts, from, to);
      if (!match) continue;
    } else if (from || to) {
      const m = from ? matchRoute(pts, from, pts[pts.length - 1], 3) : matchRoute(pts, pts[0], to!, 3);
      if (!m) continue;
      match = m;
    }
    const runs = date ? (runsOn(scheduleOf(r), date) && (date > nowLocal().slice(0, 10) || r.departTime > nowLocal().slice(11)) ? [date] : []) : upcomingRuns(r, 7);
    if (!runs.length) continue;
    out.push({ ride: r, pts, match, runs });
  }
  const [taken, ratings] = await Promise.all([
    seatsTaken(
      out.map((o) => o.ride.id),
      [...new Set(out.flatMap((o) => o.runs))],
    ),
    ratingsFor(out.map((o) => o.ride.driverPhone)),
  ]);
  const nearest = (pts: s.RidePoint[], p: LatLng | null, fallback: number) => {
    if (!p) return fallback;
    let best = fallback;
    pts.forEach((q, i) => {
      if (distanceKm(q, p) < distanceKm(pts[best], p)) best = i;
    });
    return best;
  };
  return out
    .map(({ ride, pts, match, runs }): SearchResult => {
      let pickupIdx = nearest(pts, from, 0);
      let dropIdx = nearest(pts, to, pts.length - 1);
      if (dropIdx <= pickupIdx) dropIdx = Math.min(pts.length - 1, pickupIdx + 1);
      if (pickupIdx >= dropIdx) pickupIdx = Math.max(0, dropIdx - 1);
      return { ...toPublic(ride, pts, taken, runs, ratings), pickupKm: match?.pickupKm ?? 0, dropKm: match?.dropKm ?? 0, pickupIdx, dropIdx };
    })
    .filter((r) => r.runs.some((x) => x.left > 0))
    .sort((a, b) => a.runs[0].date.localeCompare(b.runs[0].date) || a.departTime.localeCompare(b.departTime) || a.pickupKm + a.dropKm - (b.pickupKm + b.dropKm));
}

/* ---------- Booking ---------- */

export const rideBookingInput = z.object({
  date: ymd,
  name: z.string().trim().min(2, "Enter your name").max(60),
  phone: z.string().trim().max(30),
  gender: z.enum(GENDERS, "Choose male or female"),
  seats: z.coerce.number().int().min(1).max(6),
  pickupIdx: z.coerce.number().int().min(0),
  dropIdx: z.coerce.number().int().min(1),
});

export type RideBookingView = {
  code: string;
  date: string;
  seats: number;
  name: string;
  phone: string;
  pickup: string;
  drop: string;
  departTime: string;
  fare: number | null;
  /** Revealed to riders who booked. */
  driverPhone: string;
  driverName: string;
  car: string;
  plate: string | null;
};

function bookingView(r: s.Ride, pts: s.RidePoint[], b: s.RideBooking): RideBookingView {
  return {
    code: b.code,
    date: b.date,
    seats: b.seats,
    name: b.name,
    phone: b.phone,
    pickup: pts[b.pickupIdx]?.name ?? "",
    drop: pts[b.dropIdx]?.name ?? "",
    departTime: r.departTime,
    fare: r.fare === null ? null : r.fare * b.seats,
    driverPhone: r.driverPhone,
    driverName: r.driverName,
    car: r.car,
    plate: r.plate,
  };
}

export async function bookRide(slug: string, raw: unknown): Promise<RideBookingView> {
  const parsed = rideBookingInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check your details");
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");
  return requireDb().transaction(async (tx) => {
    const locked = await tx.execute<{ id: number }>(sql`select id from rides where slug = ${slug} for update`);
    if (!locked[0]) throw new BookingError("Ride not found", 404);
    const [r] = await tx.select().from(s.rides).where(eq(s.rides.id, locked[0].id));
    if (r.status !== "active") throw new BookingError(r.status === "paused" ? "The driver has paused this ride." : "This ride was cancelled.", 409);
    if (!upcomingRuns(r, 60).includes(input.date)) throw new BookingError("The ride doesn't run on that day, or it has already left.", 409);
    if (r.riders !== "anyone" && r.riders !== input.gender) throw new BookingError(`This ride is for ${r.riders === "female" ? "women" : "men"} only.`, 409);
    if (phone === r.driverPhone) throw new BookingError("That's the driver's own number.");
    const pts = await tx.select().from(s.ridePoints).where(eq(s.ridePoints.rideId, r.id)).orderBy(asc(s.ridePoints.idx));
    if (input.pickupIdx >= pts.length || input.dropIdx >= pts.length || input.dropIdx <= input.pickupIdx) throw new BookingError("Choose where you get on and off");
    const sameDay = await tx
      .select()
      .from(s.rideBookings)
      .where(and(eq(s.rideBookings.rideId, r.id), eq(s.rideBookings.date, input.date)));
    if (sameDay.some((b) => b.phone === phone)) throw new BookingError("You already booked this ride for that day. Cancel it first to change.", 409);
    const left = r.seats - sameDay.reduce((n, b) => n + b.seats, 0);
    if (input.seats > left) throw new BookingError(left === 0 ? "This ride is full on that day." : `Only ${left} seat${left === 1 ? "" : "s"} left on that day.`, 409);
    const [b] = await tx
      .insert(s.rideBookings)
      .values({ rideId: r.id, date: input.date, name: input.name, phone, gender: input.gender, seats: input.seats, pickupIdx: input.pickupIdx, dropIdx: input.dropIdx, code: newCode() })
      .returning();
    return bookingView(r, pts, b);
  });
}

/** A rider's bookings on a ride with this phone and code: the next one still to travel, and the latest done. */
async function findBookings(slug: string, phoneRaw: string, code: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone || !code) return null;
  const rows = await requireDb()
    .select({ ride: s.rides, booking: s.rideBookings })
    .from(s.rideBookings)
    .innerJoin(s.rides, eq(s.rides.id, s.rideBookings.rideId))
    .where(and(eq(s.rides.slug, slug), eq(s.rideBookings.phone, phone), eq(s.rideBookings.code, code.trim().toUpperCase())))
    .orderBy(asc(s.rideBookings.date));
  if (!rows.length) return null;
  const ride = rows[0].ride;
  const now = nowLocal();
  const over = (b: s.RideBooking) => runOver(b.date, ride.departTime, now);
  return {
    ride,
    upcoming: rows.find((r) => !over(r.booking))?.booking ?? null,
    past: rows.findLast((r) => over(r.booking))?.booking ?? null,
    pts: await pointsFor([ride.id]),
  };
}

export type RiderReview = { stars: number; comment: string | null };

/** The rider's booking: the upcoming one to show as a ticket, otherwise the last one done (to rate the driver). */
export async function lookupRideBooking(slug: string, phone: string, code: string) {
  const f = await findBookings(slug, phone, code);
  if (!f) return null;
  if (f.upcoming) return { booking: bookingView(f.ride, f.pts, f.upcoming), state: "upcoming" as const, review: null };
  if (!f.past) return null;
  const [mine] = await requireDb()
    .select({ stars: s.driverReviews.stars, comment: s.driverReviews.comment })
    .from(s.driverReviews)
    .where(and(eq(s.driverReviews.driverPhone, f.ride.driverPhone), eq(s.driverReviews.riderPhone, f.past.phone)));
  return { booking: bookingView(f.ride, f.pts, f.past), state: "past" as const, review: (mine as RiderReview | undefined) ?? null };
}

export type BookingLookup = NonNullable<Awaited<ReturnType<typeof lookupRideBooking>>>;

export async function cancelRideBooking(slug: string, phone: string, code: string) {
  const f = await findBookings(slug, phone, code);
  if (!f?.upcoming) throw new BookingError("No upcoming booking found for that phone number and code.", 404);
  await requireDb().delete(s.rideBookings).where(eq(s.rideBookings.id, f.upcoming.id));
}

/* ---------- Driver reviews ---------- */

export const reviewInput = z.object({
  phone: z.string().trim().max(30),
  code: z.string().trim().max(8),
  stars: z.coerce.number().int().min(1, "Choose 1 to 5 stars").max(5, "Choose 1 to 5 stars"),
  comment: z.string().trim().max(500, "Keep it under 500 characters").optional().default(""),
});

/** A rider rates the driver after travelling: one review per rider per driver, replaced if they rate again. */
export async function reviewDriver(slug: string, raw: unknown) {
  const parsed = reviewInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check your rating");
  const { phone, code, stars, comment } = parsed.data;
  const f = await findBookings(slug, phone, code);
  if (!f) throw new BookingError("No booking found for that phone number and code.", 404);
  if (!f.past) throw new BookingError("You can rate the driver once your ride is done.", 409);
  const values = {
    driverPhone: f.ride.driverPhone,
    riderPhone: f.past.phone,
    riderName: f.past.name.trim().split(/\s+/)[0],
    rideId: f.ride.id,
    stars,
    comment: comment || null,
    updatedAt: new Date(),
  };
  await requireDb()
    .insert(s.driverReviews)
    .values(values)
    .onConflictDoUpdate({ target: [s.driverReviews.driverPhone, s.driverReviews.riderPhone], set: values });
  return { stars, comment: values.comment };
}

/* ---------- Driver's page ---------- */

export async function manageRide(token: string) {
  if (!token || token.length < 16) return null;
  const db = requireDb();
  const [r] = await db.select().from(s.rides).where(eq(s.rides.manageToken, token)).limit(1);
  if (!r) return null;
  const [pts, bookings] = await Promise.all([
    pointsFor([r.id]),
    db
      .select()
      .from(s.rideBookings)
      .where(and(eq(s.rideBookings.rideId, r.id), gte(s.rideBookings.date, todayLocal())))
      .orderBy(asc(s.rideBookings.date), asc(s.rideBookings.pickupIdx)),
  ]);
  const runs = r.status === "active" ? upcomingRuns(r, 14) : [];
  const [ratings, reviews] = await Promise.all([ratingsFor([r.driverPhone]), reviewsFor(r.driverPhone, 20)]);
  return {
    ride: r,
    rating: ratings.get(r.driverPhone) ?? null,
    reviews,
    points: pts.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng, key: p.placeKey ?? undefined })),
    runs,
    bookings: bookings.map((b) => ({
      id: b.id,
      date: b.date,
      name: b.name,
      phone: b.phone,
      gender: b.gender,
      seats: b.seats,
      pickup: pts[b.pickupIdx]?.name ?? "",
      drop: pts[b.dropIdx]?.name ?? "",
      pickupIdx: b.pickupIdx,
    })),
  };
}
export type ManageData = NonNullable<Awaited<ReturnType<typeof manageRide>>>;

export async function removeRideBooking(token: string, bookingId: number) {
  const [r] = await requireDb().select({ id: s.rides.id }).from(s.rides).where(eq(s.rides.manageToken, token));
  if (!r) throw new BookingError("Ride not found", 404);
  await requireDb()
    .delete(s.rideBookings)
    .where(and(eq(s.rideBookings.id, bookingId), eq(s.rideBookings.rideId, r.id)));
}

/* ---------- Live map ---------- */

const LIVE_MINUTES = 3;

export const liveInput = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{12,40}$/),
  role: z.enum(["driver", "rider"]),
  lat: z.number().min(23).max(37.5),
  lng: z.number().min(60).max(78),
  /** Drivers: their manage token, to link the position to their ride. */
  token: z.string().max(60).optional(),
});

/**
 * Saves someone's shared position. Drivers are linked to their ride (and shown exactly, so their riders can
 * find them); riders are stored blurred to ~300 m and shown without a name.
 */
export async function shareLive(raw: unknown) {
  const parsed = liveInput.safeParse(raw);
  if (!parsed.success) throw new BookingError("Invalid location");
  const { id, role, token } = parsed.data;
  let { lat, lng } = parsed.data;
  let rideId: number | null = null;
  let label: string | null = null;
  if (role === "driver") {
    const [r] = token ? await requireDb().select().from(s.rides).where(eq(s.rides.manageToken, token)) : [];
    if (!r) throw new BookingError("Only a ride's driver can share as driver", 403);
    rideId = r.id;
    label = r.driverName.split(" ")[0];
  } else ({ lat, lng } = blur({ lat, lng }));
  const values = { id, role, label, rideId, lat, lng, updatedAt: new Date() };
  await requireDb().insert(s.livePositions).values(values).onConflictDoUpdate({ target: s.livePositions.id, set: values });
}

export async function stopLive(id: string) {
  await requireDb().delete(s.livePositions).where(eq(s.livePositions.id, id));
}

/** Everyone currently sharing; drivers come with their ride's route summary and link. */
export async function livePositions(rideSlug?: string) {
  const db = requireDb();
  const fresh = sql`${s.livePositions.updatedAt} > now() - make_interval(mins => ${LIVE_MINUTES})`;
  const rows = await db
    .select({ p: s.livePositions, slug: s.rides.slug, status: s.rides.status })
    .from(s.livePositions)
    .leftJoin(s.rides, eq(s.rides.id, s.livePositions.rideId))
    .where(rideSlug ? and(fresh, eq(s.rides.slug, rideSlug)) : and(fresh, sql`(${s.livePositions.role} = 'rider' or ${s.rides.status} <> 'cancelled')`))
    .limit(500);
  const rideIds = [...new Set(rows.flatMap((r) => (r.p.rideId ? [r.p.rideId] : [])))];
  const pts = await pointsFor(rideIds);
  // Old rows are cleaned up now and then.
  if (Math.random() < 0.05) await db.delete(s.livePositions).where(sql`${s.livePositions.updatedAt} < now() - interval '1 hour'`);
  return rows.map(({ p, slug }) => {
    const route = pts.filter((q) => q.rideId === p.rideId);
    return {
      role: p.role,
      label: p.label,
      lat: p.lat,
      lng: p.lng,
      ride: slug && route.length ? { slug, from: route[0].name, to: route[route.length - 1].name } : null,
      secondsAgo: Math.round((Date.now() - p.updatedAt.getTime()) / 1000),
    };
  });
}
export type LivePosition = Awaited<ReturnType<typeof livePositions>>[number];

/** Super admin: every ride, newest first. */
export async function allRides() {
  const db = requireDb();
  const rows = await db.select().from(s.rides).where(ne(s.rides.status, "cancelled")).orderBy(sql`${s.rides.createdAt} desc`).limit(300);
  const pts = await pointsFor(rows.map((r) => r.id));
  return rows.map((r) => ({ ride: r, points: pts.filter((p) => p.rideId === r.id) }));
}
