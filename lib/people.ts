import "server-only";
import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { BookingError } from "@/lib/trips";

/** Admin: the people who signed in (riders and drivers), and blocking them. */

export async function listPeople(q: string, show: "all" | "blocked") {
  const db = requireDb();
  const term = q.trim();
  const digits = term.replace(/\D/g, "");
  const phone = digits.length >= 4 ? (normalizePhone(term) ?? digits.replace(/^0/, "")) : null;
  const where = and(
    show === "blocked" ? isNotNull(s.users.blockedAt) : undefined,
    term ? or(ilike(s.users.name, `%${term}%`), ilike(s.users.email, `%${term}%`), phone ? ilike(s.users.phone, `%${phone}%`) : undefined) : undefined,
  );
  const people = await db.select().from(s.users).where(where).orderBy(desc(s.users.lastSeenAt)).limit(100);
  const ids = people.map((p) => p.id);
  const phones = people.flatMap((p) => (p.phone ? [p.phone] : []));
  const [rides, bookings] = await Promise.all([
    phones.length
      ? db
          .select({ phone: s.rides.driverPhone, n: sql<number>`count(*)::int` })
          .from(s.rides)
          .where(inArray(s.rides.driverPhone, phones))
          .groupBy(s.rides.driverPhone)
      : [],
    ids.length
      ? db
          .select({ phone: s.rideBookings.phone, n: sql<number>`count(*)::int` })
          .from(s.rideBookings)
          .where(inArray(s.rideBookings.phone, phones.length ? phones : [""]))
          .groupBy(s.rideBookings.phone)
      : [],
  ]);
  const count = (rows: { phone: string; n: number }[], p: string | null) => (p ? (rows.find((r) => r.phone === p)?.n ?? 0) : 0);
  return people.map((p) => ({ ...p, rides: count(rides, p.phone), bookings: count(bookings, p.phone) }));
}

export async function personDetail(id: number) {
  const db = requireDb();
  const [u] = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  if (!u) return null;
  const mine = u.phone ? or(eq(s.rides.driverPhone, u.phone), eq(s.rides.userId, u.id)) : eq(s.rides.userId, u.id);
  const [rides, bookings, ident, blocker] = await Promise.all([
    db.select().from(s.rides).where(mine).orderBy(desc(s.rides.createdAt)).limit(50),
    u.phone
      ? db
          .select({ booking: s.rideBookings, ride: s.rides })
          .from(s.rideBookings)
          .innerJoin(s.rides, eq(s.rides.id, s.rideBookings.rideId))
          .where(eq(s.rideBookings.phone, u.phone))
          .orderBy(desc(s.rideBookings.date))
          .limit(50)
      : [],
    u.phone ? db.select({ id: s.identities.id, fullName: s.identities.fullName }).from(s.identities).where(eq(s.identities.phone, u.phone)).limit(1) : [],
    u.blockedBy ? db.select({ name: s.admins.name }).from(s.admins).where(eq(s.admins.id, u.blockedBy)).limit(1) : [],
  ]);
  return { user: u, rides, bookings, identity: ident[0] ?? null, blockedByName: blocker[0]?.name ?? null };
}

/** The account that uses this number, if any (to link ID checks and WhatsApp chats to a person). */
export async function personByPhone(phone: string) {
  const [u] = await requireDb().select({ id: s.users.id, name: s.users.name, blockedAt: s.users.blockedAt }).from(s.users).where(eq(s.users.phone, phone)).limit(1);
  return u ?? null;
}

/**
 * Blocks someone: they're signed out and can't sign in again, and their rides are paused so nobody books them.
 * Their number and CNIC stay on record, so they can't come back with a new Google account using them.
 */
export async function blockPerson(id: number, adminId: number, reason: string) {
  const r = reason.trim().slice(0, 300);
  if (r.length < 3) throw new BookingError("Give a reason (it's kept for your records).");
  return requireDb().transaction(async (tx) => {
    const [u] = await tx.update(s.users).set({ blockedAt: new Date(), blockReason: r, blockedBy: adminId }).where(eq(s.users.id, id)).returning();
    if (!u) throw new BookingError("Person not found", 404);
    const paused = await tx
      .update(s.rides)
      .set({ status: "paused" })
      .where(and(u.phone ? or(eq(s.rides.driverPhone, u.phone), eq(s.rides.userId, u.id)) : eq(s.rides.userId, u.id), inArray(s.rides.status, ["active", "pending"])))
      .returning({ id: s.rides.id });
    return { paused: paused.length };
  });
}

/** Lets them back in. Their paused rides stay paused until they resume them. */
export async function unblockPerson(id: number) {
  await requireDb().update(s.users).set({ blockedAt: null, blockReason: null, blockedBy: null }).where(eq(s.users.id, id));
}

/** For ride actions done with a private ride link (no sign-in): a blocked person's number can't be used. */
export async function assertPhoneNotBlocked(phone: string) {
  const [u] = await requireDb()
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(eq(s.users.phone, phone), isNotNull(s.users.blockedAt)))
    .limit(1);
  if (u) throw new BookingError("This account has been blocked by Hamsafar. Contact us through Feedback if you think it's a mistake.", 403);
}
