import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, requireDb, schema as s } from "@/lib/db";
import { normalizePhone, nowLocal } from "@/lib/format";
import { checkSeat, findSeat, GENDERS, seatFare, type Taken } from "@/lib/layout";
import { orgInfo } from "@/lib/orgTypes";

export function newSlug() {
  return randomBytes(6).toString("base64url");
}

/** Longer secret for the driver's link, which shows names and phone numbers. */
export function newDriverToken() {
  return randomBytes(16).toString("base64url");
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

/** Why booking is closed for a trip, or null when it's open. */
export function closedReason(trip: Pick<s.Trip, "status" | "closesAt" | "date">, org?: Pick<s.Organization, "active"> | null): string | null {
  if (org && !org.active) return "Booking for this trip is not available right now.";
  if (trip.status === "closed") return "Booking for this trip is closed.";
  const now = nowLocal();
  if (trip.closesAt && now >= trip.closesAt) return "Booking for this trip has closed.";
  if (now.slice(0, 10) > trip.date) return "This trip has already left.";
  return null;
}

export function takenSeats(bookings: Pick<s.Booking, "seatId" | "gender">[]): Taken {
  return Object.fromEntries(bookings.map((b) => [b.seatId, b.gender]));
}

type TripWhere = { slug: string } | { id: number } | { driverToken: string };
const tripCond = (where: TripWhere) =>
  "slug" in where ? eq(s.trips.slug, where.slug) : "id" in where ? eq(s.trips.id, where.id) : eq(s.trips.driverToken, where.driverToken);

export async function loadTrip(where: TripWhere) {
  if (!db) return null;
  const [row] = await db
    .select({ trip: s.trips, org: s.organizations })
    .from(s.trips)
    .innerJoin(s.organizations, eq(s.organizations.id, s.trips.orgId))
    .where(tripCond(where))
    .limit(1);
  if (!row) return null;
  const { trip, org } = row;
  const [stops, bookings] = await Promise.all([
    db.select().from(s.stops).where(eq(s.stops.tripId, trip.id)).orderBy(asc(s.stops.sortOrder), asc(s.stops.time)),
    db.select().from(s.bookings).where(eq(s.bookings.tripId, trip.id)).orderBy(asc(s.bookings.createdAt)),
  ]);
  return { trip, org, stops, bookings };
}

export type PublicOrg = { name: string; slug: string; type: s.Organization["type"]; phone: string | null; city: string | null };
const publicOrg = (o: s.Organization): PublicOrg => ({ name: o.name, slug: o.slug, type: o.type, phone: o.phone, city: o.city });

/** What anyone with the link can see: no names or phone numbers, only which seats are taken and by which gender. */
export async function publicTrip(slug: string) {
  const data = await loadTrip({ slug });
  if (!data) return null;
  const { trip, org, stops, bookings } = data;
  return {
    org: publicOrg(org),
    title: trip.title,
    direction: trip.direction,
    date: trip.date,
    endDate: trip.endDate,
    departTime: trip.departTime,
    vehicleName: trip.vehicleName,
    notes: trip.notes,
    closesAt: trip.closesAt,
    closed: closedReason(trip, org),
    layout: trip.layout,
    fare: trip.fare,
    genderRule: trip.genderRule,
    maxSeats: trip.maxSeats,
    membersOnly: trip.membersOnly,
    stops: stops.map((st) => ({ id: st.id, name: st.name, time: st.time })),
    taken: takenSeats(bookings),
  };
}
export type PublicTrip = NonNullable<Awaited<ReturnType<typeof publicTrip>>>;

export const bookingInput = z.object({
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30),
  gender: z.enum(GENDERS).optional().nullable(),
  /** Roll number / employee ID, for members-only trips. */
  refNo: z.string().trim().max(40).optional(),
  stopId: z.coerce.number().int().positive("Choose your stop"),
  /** One seat, or several for a group on trips that allow it. */
  seatId: z.string().regex(/^\d+-\d+$/).optional(),
  seatIds: z.array(z.string().regex(/^\d+-\d+$/)).max(12).optional(),
});
export type BookingInput = z.infer<typeof bookingInput>;

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export type BookingView = {
  code: string;
  name: string;
  phone: string;
  gender: s.Booking["gender"];
  seats: { id: string; label: string; fare: number | null }[];
  /** "3" or "3, 4, 5" */
  seatLabel: string;
  /** First seat, for highlighting. */
  seatId: string;
  stop: string;
  time: string;
  /** Total for all seats; null when no fare is set. */
  fare: number | null;
};

function view(trip: s.Trip, stop: s.Stop, rows: s.Booking[]): BookingView {
  const seats = rows
    .map((b) => ({ id: b.seatId, label: findSeat(trip.layout, b.seatId)?.label ?? b.seatId, fare: b.fare }))
    .sort((a, b) => Number(a.label) - Number(b.label));
  const fares = seats.map((x) => x.fare).filter((f): f is number => f !== null);
  const first = rows[0];
  return {
    code: first.code,
    name: first.name,
    phone: first.phone,
    gender: first.gender,
    seats,
    seatLabel: seats.map((x) => x.label).join(", "),
    seatId: seats[0].id,
    stop: stop.name,
    time: stop.time,
    fare: fares.length ? fares.reduce((a, b) => a + b, 0) : null,
  };
}

/** A registered rider of the trip's organisation, matched by phone (and roll no. / employee ID when they have one). */
async function findRider(orgId: number, phone: string, refNo: string | undefined, checkRef: boolean) {
  const [rider] = await requireDb()
    .select()
    .from(s.riders)
    .where(and(eq(s.riders.orgId, orgId), eq(s.riders.phone, phone), eq(s.riders.active, true)))
    .limit(1);
  if (!rider) return null;
  if (checkRef && rider.refNo && rider.refNo.trim().toLowerCase() !== (refNo ?? "").trim().toLowerCase()) return null;
  return rider;
}

/** For members-only trips: who is this phone (+ roll no.)? Lets the booking page show "Booking as Ayesha (female)". */
export async function identifyRider(slug: string, phoneRaw: string, refNo: string) {
  const data = await loadTrip({ slug });
  if (!data || !data.trip.membersOnly) return null;
  const phone = normalizePhone(phoneRaw);
  if (!phone) return null;
  const rider = await findRider(data.org.id, phone, refNo, true);
  return rider ? { name: rider.name, gender: rider.gender, needsRef: !!rider.refNo } : null;
}

/**
 * Books one or more seats. The trip row is locked for the duration, so two people can't take the same seat or
 * opposite-gender neighbouring seats at the same moment. With `asAdmin`, closed trips can still be booked and
 * members-only trips don't need the roll number.
 */
export async function bookSeat(where: { slug: string } | { id: number }, raw: unknown, asAdmin = false): Promise<BookingView> {
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check your details");
  const input = parsed.data;
  const seatIds = [...new Set(input.seatIds?.length ? input.seatIds : input.seatId ? [input.seatId] : [])];
  if (!seatIds.length) throw new BookingError("Choose a seat");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");

  return requireDb().transaction(async (tx) => {
    const cond = "slug" in where ? sql`slug = ${where.slug}` : sql`id = ${where.id}`;
    const locked = await tx.execute<{ id: number }>(sql`select id from trips where ${cond} for update`);
    const tripId = locked[0]?.id;
    if (!tripId) throw new BookingError("Trip not found", 404);
    const [{ trip, org }] = await tx
      .select({ trip: s.trips, org: s.organizations })
      .from(s.trips)
      .innerJoin(s.organizations, eq(s.organizations.id, s.trips.orgId))
      .where(eq(s.trips.id, tripId));

    const closed = closedReason(trip, org);
    if (closed && !asAdmin) throw new BookingError(closed, 409);

    const [stop] = await tx.select().from(s.stops).where(and(eq(s.stops.id, input.stopId), eq(s.stops.tripId, trip.id)));
    if (!stop) throw new BookingError("Choose your stop");

    if (seatIds.length > trip.maxSeats)
      throw new BookingError(trip.maxSeats === 1 ? "You can book one seat on this trip." : `You can book up to ${trip.maxSeats} seats at once.`);

    // Who is travelling: a registered rider (name and gender from the list) or whoever filled in the form.
    let name = input.name?.trim() ?? "";
    let gender = input.gender ?? null;
    let riderId: number | null = null;
    if (trip.membersOnly) {
      const rider = await findRider(org.id, phone, input.refNo, !asAdmin);
      if (!rider) {
        const who = orgInfo(org.type).riders;
        throw new BookingError(
          `This number isn't on ${org.name}'s list of registered ${who}${input.refNo ? " with that " + orgInfo(org.type).refLabel.toLowerCase() : ""}. Ask your transport office to add you.`,
          403,
        );
      }
      name = rider.name;
      gender = rider.gender;
      riderId = rider.id;
    }
    if (name.length < 2) throw new BookingError("Enter your name");
    if (trip.genderRule === "separate" && !gender) throw new BookingError("Choose female or male");

    const existing = await tx.select().from(s.bookings).where(eq(s.bookings.tripId, trip.id));
    const mine = existing.filter((b) => b.phone === phone);
    if (mine.length) {
      const labels = mine.map((b) => findSeat(trip.layout, b.seatId)?.label ?? b.seatId).join(", ");
      throw new BookingError(
        `This phone number already has seat${mine.length > 1 ? "s" : ""} ${labels} on this trip. Cancel that booking first to change seats.`,
        409,
      );
    }

    // Check seats one by one, as if each were already taken, so a group can't break the rules among itself.
    const taken = takenSeats(existing);
    for (const id of seatIds) {
      const check = checkSeat(trip.layout, taken, id, gender, trip.genderRule);
      if (!check.ok) throw new BookingError(check.reason, 409);
      taken[id] = gender;
    }

    const code = newCode();
    const rows = await tx
      .insert(s.bookings)
      .values(
        seatIds.map((seatId) => ({
          tripId: trip.id,
          stopId: stop.id,
          seatId,
          name,
          phone,
          gender,
          riderId,
          code,
          fare: seatFare(trip.layout, seatId, trip.fare),
        })),
      )
      .returning();
    return view(trip, stop, rows);
  });
}

async function findOwnBooking(slug: string, phoneRaw: string, codeRaw: string) {
  const phone = normalizePhone(phoneRaw);
  const code = codeRaw.trim().toUpperCase();
  if (!phone || !code) return null;
  const rows = await requireDb()
    .select({ trip: s.trips, org: s.organizations, stop: s.stops, booking: s.bookings })
    .from(s.bookings)
    .innerJoin(s.trips, eq(s.trips.id, s.bookings.tripId))
    .innerJoin(s.organizations, eq(s.organizations.id, s.trips.orgId))
    .innerJoin(s.stops, eq(s.stops.id, s.bookings.stopId))
    .where(and(eq(s.trips.slug, slug), eq(s.bookings.phone, phone), eq(s.bookings.code, code)));
  return rows.length ? { trip: rows[0].trip, org: rows[0].org, stop: rows[0].stop, bookings: rows.map((r) => r.booking) } : null;
}

export async function lookupBooking(slug: string, phone: string, code: string): Promise<BookingView | null> {
  const found = await findOwnBooking(slug, phone, code);
  return found ? view(found.trip, found.stop, found.bookings) : null;
}

/** Cancels every seat booked under this phone + code. */
export async function cancelBooking(slug: string, phone: string, code: string) {
  const found = await findOwnBooking(slug, phone, code);
  if (!found) throw new BookingError("No booking found for that phone number and code.", 404);
  if (closedReason(found.trip, found.org)) throw new BookingError("Booking is closed, so changes go through the admin now.", 409);
  await requireDb()
    .delete(s.bookings)
    .where(and(eq(s.bookings.tripId, found.trip.id), eq(s.bookings.phone, found.bookings[0].phone), eq(s.bookings.code, found.bookings[0].code)));
}

/* ---------- Driver view ---------- */

export type DriverPassenger = {
  id: number;
  seatLabel: string;
  name: string;
  phone: string;
  gender: s.Booking["gender"];
  fare: number | null;
  boarded: boolean;
  paid: boolean;
};

/** Everything the driver needs, in route order. Only reachable with the trip's secret driver token. */
export async function driverTrip(token: string) {
  if (!token || token.length < 16) return null;
  const data = await loadTrip({ driverToken: token });
  if (!data) return null;
  const { trip, org, stops, bookings } = data;
  const passenger = (b: s.Booking): DriverPassenger => ({
    id: b.id,
    seatLabel: findSeat(trip.layout, b.seatId)?.label ?? b.seatId,
    name: b.name,
    phone: b.phone,
    gender: b.gender,
    fare: b.fare,
    boarded: b.boarded,
    paid: b.paid,
  });
  return {
    org: publicOrg(org),
    title: trip.title,
    direction: trip.direction,
    date: trip.date,
    endDate: trip.endDate,
    departTime: trip.departTime,
    vehicleName: trip.vehicleName,
    stops: stops.map((st) => ({
      id: st.id,
      name: st.name,
      time: st.time,
      passengers: bookings
        .filter((b) => b.stopId === st.id)
        .map(passenger)
        .sort((a, b) => Number(a.seatLabel) - Number(b.seatLabel)),
    })),
  };
}
export type DriverTrip = NonNullable<Awaited<ReturnType<typeof driverTrip>>>;

export const markInput = z.object({
  bookingId: z.number().int().positive(),
  field: z.enum(["boarded", "paid"]),
  value: z.boolean(),
});

/** Ticks a passenger as boarded or paid. `where` is the driver token, or the trip id for admins. */
export async function markBooking(where: { driverToken: string } | { id: number }, raw: unknown) {
  const parsed = markInput.safeParse(raw);
  if (!parsed.success) throw new BookingError("Invalid request");
  const { bookingId, field, value } = parsed.data;
  const [trip] = await requireDb().select({ id: s.trips.id }).from(s.trips).where(tripCond(where)).limit(1);
  if (!trip) throw new BookingError("Trip not found", 404);
  const updated = await requireDb()
    .update(s.bookings)
    .set({ [field]: value })
    .where(and(eq(s.bookings.id, bookingId), eq(s.bookings.tripId, trip.id)))
    .returning({ id: s.bookings.id });
  if (!updated.length) throw new BookingError("That passenger is no longer on this trip.", 404);
}
