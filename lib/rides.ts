import "server-only";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { requireDb, schema as s } from "@/lib/db";
import { normalizePhone, nowLocal, todayLocal } from "@/lib/format";
import { blur, distanceKm, matchRoute, matchStops, type LatLng } from "@/lib/geo";
import { inCityArea, MATCH_RADIUS_KM, RIDE_KINDS, type RideKind } from "@/lib/cities";
import { GENDERS } from "@/lib/layout";
import { BookingError } from "@/lib/trips";
import { driverGate, identityByPhone, riderGate, verifiedDrivers } from "@/lib/identity";
import { phoneFor } from "@/lib/account";
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
    kind: z.enum(RIDE_KINDS).default("city"),
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
  if (r.kind === "city") {
    const out = r.points.find((p) => !inCityArea(p));
    if (out) throw new BookingError(`"${out.name}" is outside the city area. City rides are within Islamabad, Rawalpindi, Wah, Taxila and Rawat. For other cities, choose "Between cities".`);
  } else if (r.points.every(inCityArea)) {
    throw new BookingError(`This whole route is inside Islamabad, Rawalpindi, Wah, Taxila and Rawat. Choose "In the city" instead.`);
  }
  return {
    ride: {
      kind: r.kind,
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

/** The phone-check token the browser sends along (see lib/verify.ts). */
const tokenOf = (raw: unknown) => (raw && typeof raw === "object" ? (raw as { phoneToken?: unknown }).phoneToken : undefined);
/** The CNIC number a returning driver types to confirm it's them. */
const cnicOf = (raw: unknown) => (raw && typeof raw === "object" ? (raw as { driverCnic?: unknown }).driverCnic : undefined);

/** `user`: the signed-in driver (null only while Google sign-in isn't switched on). */
export async function createRide(raw: unknown, user: s.User | null) {
  const { ride, points } = readRide(raw);
  ride.driverPhone = await phoneFor(user, ride.driverPhone, tokenOf(raw));
  if (ride.schedule === "once" && ride.date < todayLocal()) throw new BookingError("The date has already passed");
  // The driver's ID: rides of drivers still being checked are saved, and go live once they're approved.
  const { status, gender } = await driverGate(ride.driverPhone, cnicOf(raw));
  // Women-only rides rely on this, so it comes from the ID, not the form.
  ride.driverGender = gender;
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(s.rides)
      .values({ ...ride, status, userId: user?.id ?? null, slug: randomBytes(5).toString("base64url"), manageToken: randomBytes(16).toString("base64url") })
      .returning();
    await tx.insert(s.ridePoints).values(points.map((p, idx) => ({ rideId: row.id, idx, name: p.name, lat: p.lat, lng: p.lng, placeKey: p.key ?? null })));
    return { slug: row.slug, manageToken: row.manageToken, status };
  });
}

/** Replaces a ride's details and route (only while nobody has booked a future date at a removed stop). */
/** `user`: whoever is signed in, if anyone (the manage link is the key to the ride). */
export async function updateRide(token: string, raw: unknown, user: s.User | null = null) {
  const { ride, points } = readRide(raw);
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(s.rides).where(eq(s.rides.manageToken, token)).for("update");
    if (!row) throw new BookingError("Ride not found", 404);
    // A new number for the driver has to be checked like the first one.
    if (ride.driverPhone !== row.driverPhone) {
      ride.driverPhone = await phoneFor(user, ride.driverPhone, tokenOf(raw));
      const gate = await driverGate(ride.driverPhone, cnicOf(raw));
      if (gate.status === "pending" && row.status === "active") Object.assign(ride, { status: "pending" as const });
    }
    const ident = await identityByPhone(ride.driverPhone);
    if (ident) ride.driverGender = ident.gender;
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
  const [r] = await requireDb().select().from(s.rides).where(eq(s.rides.manageToken, token));
  if (!r) throw new BookingError("Ride not found", 404);
  if (status === "pending") throw new BookingError("Not allowed");
  // Only a driver whose ID is approved can put a ride live (a waiting ride goes live by itself on approval).
  if (status === "active" && r.status !== "active") {
    const i = await identityByPhone(r.driverPhone);
    if (i?.driverStatus !== "approved") throw new BookingError("Your ride goes live once your ID is approved.", 403);
  }
  await requireDb().update(s.rides).set({ status }).where(eq(s.rides.id, r.id));
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
  /** The driver's CNIC and licence were checked by Hamsafar. */
  verified: boolean;
  kind: RideKind;
};

export type DriverRating = { avg: number; count: number };
export type PublicReview = { name: string; stars: number; comment: string | null; date: string };

function toPublic(r: s.Ride, points: s.RidePoint[], taken: Map<string, number>, runs: string[], ratings: Map<string, DriverRating>, verified: Set<string>): PublicRide {
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
    verified: verified.has(r.driverPhone),
    kind: r.kind,
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
  const [points, taken, ratings, reviews, verified] = await Promise.all([
    pointsFor([r.id]),
    seatsTaken([r.id], runs),
    ratingsFor([r.driverPhone]),
    reviewsFor(r.driverPhone),
    verifiedDrivers([r.driverPhone]),
  ]);
  return { ...toPublic(r, points, taken, runs, ratings, verified), reviews };
}

export type SearchResult = PublicRide & { pickupKm: number; dropKm: number; pickupIdx: number; dropIdx: number };

/**
 * Active rides of `kind` passing near `from` and then `to`, running on `date` (or any of the next 7 days when null).
 * City rides match anywhere along the route; rides between cities only near their stops.
 */
export async function searchRides(from: LatLng | null, to: LatLng | null, date: string | null, kind: RideKind = "city") {
  const db = requireDb();
  const today = todayLocal();
  const rows = await db
    .select()
    .from(s.rides)
    .where(and(eq(s.rides.status, "active"), eq(s.rides.kind, kind), sql`((${s.rides.schedule} <> 'once' and (${s.rides.until} is null or ${s.rides.until} >= ${today})) or ${s.rides.date} >= ${today})`))
    .limit(500);
  const active = rows.filter((r) => r.status === "active");
  const points = await pointsFor(active.map((r) => r.id));
  const out: { ride: s.Ride; pts: s.RidePoint[]; match: ReturnType<typeof matchRoute>; runs: string[] }[] = [];
  const matcher = kind === "city" ? matchRoute : matchStops;
  const radius = MATCH_RADIUS_KM[kind];
  for (const r of active) {
    const pts = points.filter((p) => p.rideId === r.id);
    if (pts.length < 2) continue;
    let match: ReturnType<typeof matchRoute> = null;
    if (from && to) {
      match = matcher(pts, from, to, radius);
      if (!match) continue;
    } else if (from || to) {
      const m = from ? matcher(pts, from, pts[pts.length - 1], radius) : matcher(pts, pts[0], to!, radius);
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
  const verified = await verifiedDrivers(out.map((o) => o.ride.driverPhone));
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
      return { ...toPublic(ride, pts, taken, runs, ratings, verified), pickupKm: match?.pickupKm ?? 0, dropKm: match?.dropKm ?? 0, pickupIdx, dropIdx };
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
  /** The rider checked the driver's ride code in the car. */
  boarded: boolean;
  /** The driver marked the rider as not at the pickup. */
  noShow: boolean;
  /** Wrong ride codes left before the check stops. */
  codeTriesLeft: number;
};

const BOARD_TRIES = 5;

/**
 * The 4-digit code a driver tells each rider when they get in, different for every ride and day.
 * Derived from the server secret, so it isn't stored and can't be guessed from the ride's links.
 */
export function rideCode(rideId: number, date: string) {
  const h = createHmac("sha256", `hamsafar-ride-code:${process.env.AUTH_SECRET ?? ""}`).update(`${rideId}:${date}`).digest();
  return String(1000 + (h.readUInt32BE(0) % 9000));
}

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
    boarded: !!b.boardedAt,
    noShow: !!b.noShowAt,
    codeTriesLeft: Math.max(0, BOARD_TRIES - b.boardTries),
  };
}

/** `user`: the signed-in rider (null only while Google sign-in isn't switched on). */
export async function bookRide(slug: string, raw: unknown, user: s.User | null): Promise<RideBookingView> {
  const parsed = rideBookingInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check your details");
  const input = parsed.data;
  const phone = await phoneFor(user, input.phone, tokenOf(raw));
  // Riders need an ID on file; their gender comes from it (that's what women-only rides check).
  const { gender } = await riderGate(phone);
  input.gender = gender;
  return requireDb().transaction(async (tx) => {
    const locked = await tx.execute<{ id: number }>(sql`select id from rides where slug = ${slug} for update`);
    if (!locked[0]) throw new BookingError("Ride not found", 404);
    const [r] = await tx.select().from(s.rides).where(eq(s.rides.id, locked[0].id));
    if (r.status !== "active")
      throw new BookingError(
        r.status === "paused" ? "The driver has paused this ride." : r.status === "pending" ? "This ride isn't live yet: the driver's ID is still being checked." : "This ride was cancelled.",
        409,
      );
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
      .values({ rideId: r.id, userId: user?.id ?? null, date: input.date, name: input.name, phone, gender: input.gender, seats: input.seats, pickupIdx: input.pickupIdx, dropIdx: input.dropIdx, code: newCode() })
      .returning();
    return bookingView(r, pts, b);
  });
}

/** A rider's bookings on a ride with this phone and code: the next one still to travel, and the latest done. */
async function findBookings(slug: string, phoneRaw: string, code: string | null) {
  const phone = normalizePhone(phoneRaw);
  // No code: only for a signed-in account's own checked number (see bookingForAccount).
  if (!phone || code === "") return null;
  const rows = await requireDb()
    .select({ ride: s.rides, booking: s.rideBookings })
    .from(s.rideBookings)
    .innerJoin(s.rides, eq(s.rides.id, s.rideBookings.rideId))
    .where(and(eq(s.rides.slug, slug), eq(s.rideBookings.phone, phone), code === null ? undefined : eq(s.rideBookings.code, code.trim().toUpperCase())))
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
export async function lookupRideBooking(slug: string, phone: string, code: string | null) {
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

/**
 * In the car: the rider types the ride code the driver tells them. A match proves it's the driver they
 * booked; a wrong code warns them not to get in. Only on the day of the booking, and a few tries only.
 */
export async function boardRide(slug: string, phone: string, code: string, rawRideCode: unknown) {
  const f = await findBookings(slug, phone, code);
  const today = todayLocal();
  const b = [f?.upcoming, f?.past].find((x) => x?.date === today);
  if (!f || !b) throw new BookingError("No booking for today found for that phone number and code.", 404);
  if (b.boardedAt) return bookingView(f.ride, f.pts, b);
  if (b.boardTries >= BOARD_TRIES)
    throw new BookingError("Too many wrong codes. Don't get in: call the driver on the number in your booking, or 15 if you feel unsafe.", 429, { code: "board_locked", triesLeft: 0 });
  const given = String(rawRideCode ?? "").replace(/\D/g, "");
  const db = requireDb();
  if (given !== rideCode(f.ride.id, b.date)) {
    // Atomic, so tries can't be raced past the limit.
    const [row] = await db
      .update(s.rideBookings)
      .set({ boardTries: sql`${s.rideBookings.boardTries} + 1` })
      .where(eq(s.rideBookings.id, b.id))
      .returning({ tries: s.rideBookings.boardTries });
    const triesLeft = Math.max(0, BOARD_TRIES - row.tries);
    throw new BookingError("That code doesn't match. Don't get in: this may not be the driver you booked.", 400, { code: "wrong_ride_code", triesLeft });
  }
  const [row] = await db.update(s.rideBookings).set({ boardedAt: new Date(), noShowAt: null }).where(eq(s.rideBookings.id, b.id)).returning();
  return bookingView(f.ride, f.pts, row);
}

export const tripInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("leave"), stopIdx: z.number().int().min(0) }),
  z.object({ action: z.literal("noshow"), bookingId: z.number().int(), undo: z.boolean().optional() }),
]);

/**
 * Today's trip, by the driver: leave a stop (only once every rider getting on there or before is on board,
 * or marked not there), or mark a rider as not at the pickup (from the leaving time).
 */
export async function tripAction(token: string, raw: unknown) {
  const parsed = tripInput.safeParse(raw);
  if (!parsed.success) throw new BookingError("Check the request");
  const input = parsed.data;
  const date = todayLocal();
  return requireDb().transaction(async (tx) => {
    const [r] = await tx.select().from(s.rides).where(eq(s.rides.manageToken, token)).for("update");
    if (!r) throw new BookingError("Ride not found", 404);
    if (r.status !== "active") throw new BookingError("This ride isn't live.", 409);
    if (!runsOn(scheduleOf(r), date)) throw new BookingError("This ride doesn't run today.", 409);
    const today = await tx
      .select()
      .from(s.rideBookings)
      .where(and(eq(s.rideBookings.rideId, r.id), eq(s.rideBookings.date, date)));
    const [trip] = await tx
      .select()
      .from(s.rideTrips)
      .where(and(eq(s.rideTrips.rideId, r.id), eq(s.rideTrips.date, date)));
    const leftIdx = trip?.leftIdx ?? -1;
    if (input.action === "noshow") {
      const b = today.find((x) => x.id === input.bookingId);
      if (!b) throw new BookingError("Booking not found", 404);
      if (b.boardedAt) throw new BookingError(`${b.name} is already on board.`, 409);
      if (!input.undo && nowLocal().slice(11, 16) < r.departTime) throw new BookingError(`You can mark a rider as not here from ${r.departTime}, the leaving time.`, 409);
      await tx.update(s.rideBookings).set({ noShowAt: input.undo ? null : new Date() }).where(eq(s.rideBookings.id, b.id));
      return { leftIdx };
    }
    const pts = await tx.select({ idx: s.ridePoints.idx }).from(s.ridePoints).where(eq(s.ridePoints.rideId, r.id));
    if (input.stopIdx >= pts.length - 1) throw new BookingError("That's the last stop.");
    if (input.stopIdx <= leftIdx) return { leftIdx };
    const waiting = today.filter((b) => b.pickupIdx <= input.stopIdx && !b.boardedAt && !b.noShowAt);
    if (waiting.length)
      throw new BookingError(
        `Waiting for ${waiting.map((b) => b.name).join(", ")} to enter the ride code. Tell them the code, or mark them as not here.`,
        409,
        { code: "riders_waiting", waiting: waiting.map((b) => b.id) },
      );
    await tx
      .insert(s.rideTrips)
      .values({ rideId: r.id, date, leftIdx: input.stopIdx })
      .onConflictDoUpdate({ target: [s.rideTrips.rideId, s.rideTrips.date], set: { leftIdx: input.stopIdx, updatedAt: new Date() } });
    return { leftIdx: input.stopIdx };
  });
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
  const [ratings, reviews, ident, [trip]] = await Promise.all([
    ratingsFor([r.driverPhone]),
    reviewsFor(r.driverPhone, 20),
    identityByPhone(r.driverPhone),
    db
      .select()
      .from(s.rideTrips)
      .where(and(eq(s.rideTrips.rideId, r.id), eq(s.rideTrips.date, todayLocal()))),
  ]);
  return {
    ride: r,
    idCheck: ident ? { status: ident.driverStatus, submittedAt: ident.submittedAt.toISOString(), rejectReason: ident.rejectReason } : null,
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
      boarded: !!b.boardedAt,
      noShow: !!b.noShowAt,
    })),
    /** Today's trip: the last stop left (-1 before starting), or null when the ride doesn't run today. */
    trip: runs.includes(todayLocal()) || bookings.some((b) => b.date === todayLocal()) ? { date: todayLocal(), leftIdx: trip?.leftIdx ?? -1 } : null,
    /** The code to tell riders as they get in, for each upcoming day. */
    rideCodes: Object.fromEntries([...new Set([...runs.slice(0, 7), ...bookings.map((b) => b.date)])].map((d) => [d, rideCode(r.id, d)])),
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

/** The signed-in person's booking on this ride (by their account's checked number), for any of their phones. */
export async function bookingForAccount(slug: string, user: s.User | null) {
  return user?.phone ? lookupRideBooking(slug, user.phone, null) : null;
}
