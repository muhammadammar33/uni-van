import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, requireDb, schema as s } from "@/lib/db";
import { nowLocal } from "@/lib/format";
import { checkSeat, findSeat, GENDERS, type Taken } from "@/lib/layout";
import { normalizePhone } from "@/lib/format";

export function newSlug() {
  return randomBytes(6).toString("base64url");
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  return Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

/** Why booking is closed for a trip, or null when it's open. */
export function closedReason(trip: Pick<s.Trip, "status" | "closesAt" | "date">): string | null {
  if (trip.status === "closed") return "Booking for this trip is closed.";
  const now = nowLocal();
  if (trip.closesAt && now >= trip.closesAt) return "Booking for this trip has closed.";
  if (now.slice(0, 10) > trip.date) return "This trip has already left.";
  return null;
}

export function takenSeats(bookings: Pick<s.Booking, "seatId" | "gender">[]): Taken {
  return Object.fromEntries(bookings.map((b) => [b.seatId, b.gender]));
}

export async function loadTrip(where: { slug: string } | { id: number }) {
  if (!db) return null;
  const [trip] = await db
    .select()
    .from(s.trips)
    .where("slug" in where ? eq(s.trips.slug, where.slug) : eq(s.trips.id, where.id))
    .limit(1);
  if (!trip) return null;
  const [stops, bookings] = await Promise.all([
    db.select().from(s.stops).where(eq(s.stops.tripId, trip.id)).orderBy(asc(s.stops.sortOrder), asc(s.stops.time)),
    db.select().from(s.bookings).where(eq(s.bookings.tripId, trip.id)).orderBy(asc(s.bookings.createdAt)),
  ]);
  return { trip, stops, bookings };
}

/** What anyone with the link can see: no names or phone numbers, only which seats are taken and by which gender. */
export async function publicTrip(slug: string) {
  const data = await loadTrip({ slug });
  if (!data) return null;
  const { trip, stops, bookings } = data;
  return {
    title: trip.title,
    direction: trip.direction,
    date: trip.date,
    departTime: trip.departTime,
    vehicleName: trip.vehicleName,
    notes: trip.notes,
    closesAt: trip.closesAt,
    closed: closedReason(trip),
    layout: trip.layout,
    stops: stops.map((st) => ({ id: st.id, name: st.name, time: st.time })),
    taken: takenSeats(bookings),
  };
}
export type PublicTrip = NonNullable<Awaited<ReturnType<typeof publicTrip>>>;

export const bookingInput = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().max(30),
  gender: z.enum(GENDERS),
  stopId: z.coerce.number().int().positive("Choose your stop"),
  seatId: z.string().regex(/^\d+-\d+$/, "Choose a seat"),
});
export type BookingInput = z.infer<typeof bookingInput>;

export class BookingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type BookingView = { code: string; name: string; phone: string; gender: s.Booking["gender"]; seatId: string; seatLabel: string; stop: string; time: string };

function view(trip: s.Trip, stop: s.Stop, b: s.Booking): BookingView {
  return {
    code: b.code,
    name: b.name,
    phone: b.phone,
    gender: b.gender,
    seatId: b.seatId,
    seatLabel: findSeat(trip.layout, b.seatId)?.label ?? b.seatId,
    stop: stop.name,
    time: stop.time,
  };
}

/**
 * Books a seat. The trip row is locked for the duration, so two people can't take the same seat or
 * opposite-gender neighbouring seats at the same moment. With `asAdmin`, closed trips can still be booked.
 */
export async function bookSeat(where: { slug: string } | { id: number }, raw: unknown, asAdmin = false): Promise<BookingView> {
  const parsed = bookingInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check your details");
  const input = parsed.data;
  const phone = normalizePhone(input.phone);
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");

  return requireDb().transaction(async (tx) => {
    const cond = "slug" in where ? sql`slug = ${where.slug}` : sql`id = ${where.id}`;
    const locked = await tx.execute<{ id: number }>(sql`select id from trips where ${cond} for update`);
    const tripId = locked[0]?.id;
    if (!tripId) throw new BookingError("Trip not found", 404);
    const [trip] = await tx.select().from(s.trips).where(eq(s.trips.id, tripId));

    const closed = closedReason(trip);
    if (closed && !asAdmin) throw new BookingError(closed, 409);

    const [stop] = await tx.select().from(s.stops).where(and(eq(s.stops.id, input.stopId), eq(s.stops.tripId, trip.id)));
    if (!stop) throw new BookingError("Choose your stop");

    const existing = await tx.select().from(s.bookings).where(eq(s.bookings.tripId, trip.id));
    const mine = existing.find((b) => b.phone === phone);
    if (mine) {
      const label = findSeat(trip.layout, mine.seatId)?.label ?? mine.seatId;
      throw new BookingError(`This phone number already has seat ${label} on this trip. Cancel that booking first to change seats.`, 409);
    }

    const check = checkSeat(trip.layout, takenSeats(existing), input.seatId, input.gender);
    if (!check.ok) throw new BookingError(check.reason, 409);

    const [booking] = await tx
      .insert(s.bookings)
      .values({ tripId: trip.id, stopId: stop.id, seatId: input.seatId, name: input.name, phone, gender: input.gender, code: newCode() })
      .returning();
    return view(trip, stop, booking);
  });
}

async function findOwnBooking(slug: string, phoneRaw: string, codeRaw: string) {
  const phone = normalizePhone(phoneRaw);
  const code = codeRaw.trim().toUpperCase();
  if (!phone || !code) return null;
  const rows = await requireDb()
    .select({ trip: s.trips, stop: s.stops, booking: s.bookings })
    .from(s.bookings)
    .innerJoin(s.trips, eq(s.trips.id, s.bookings.tripId))
    .innerJoin(s.stops, eq(s.stops.id, s.bookings.stopId))
    .where(and(eq(s.trips.slug, slug), eq(s.bookings.phone, phone), eq(s.bookings.code, code)))
    .limit(1);
  return rows[0] ?? null;
}

export async function lookupBooking(slug: string, phone: string, code: string): Promise<BookingView | null> {
  const row = await findOwnBooking(slug, phone, code);
  return row ? view(row.trip, row.stop, row.booking) : null;
}

export async function cancelBooking(slug: string, phone: string, code: string) {
  const row = await findOwnBooking(slug, phone, code);
  if (!row) throw new BookingError("No booking found for that phone number and code.", 404);
  if (closedReason(row.trip)) throw new BookingError("Booking is closed, so changes go through the admin now.", 409);
  await requireDb().delete(s.bookings).where(eq(s.bookings.id, row.booking.id));
}
