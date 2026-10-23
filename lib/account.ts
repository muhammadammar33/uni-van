import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import { db, requireDb, schema as s } from "@/lib/db";
import { normalizePhone, todayLocal } from "@/lib/format";
import { BookingError } from "@/lib/trips";
import { USER_COOKIE, readUserSession } from "@/lib/userSession";
import { requireVerifiedPhone } from "@/lib/verify";

/**
 * Accounts for riders and drivers: Google sign-in. Until the Google keys are set (GOOGLE_CLIENT_ID and
 * GOOGLE_CLIENT_SECRET), nobody has to sign in and everything works as before.
 */
export const authEnabled = () => !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

export type Account = Pick<s.User, "id" | "email" | "name" | "picture" | "phone">;

/** The signed-in person (null if nobody, or if they were blocked). Once per request. */
export const currentUser = cache(async (): Promise<s.User | null> => {
  if (!db) return null;
  const id = await readUserSession((await cookies()).get(USER_COOKIE)?.value);
  if (!id) return null;
  const [u] = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return u && !u.blockedAt ? u : null;
});

/** What the browser may know about the account. */
export const publicAccount = (u: s.User | null): Account | null => (u ? { id: u.id, email: u.email, name: u.name, picture: u.picture, phone: u.phone } : null);

/** For offering and booking: the account, or (when sign-in is required) a 401 asking to sign in. */
export async function accountFor(action: string): Promise<s.User | null> {
  const u = await currentUser();
  if (!u && authEnabled()) throw new BookingError(`Please sign in with Google to ${action}.`, 401, { code: "signin_required" });
  return u;
}

/**
 * The phone number to use for this person. With an account that already has a checked number, it must be
 * that number (no new WhatsApp check). Otherwise the WhatsApp check applies, and the number is then kept
 * on the account, unless another account has it.
 */
export async function phoneFor(user: s.User | null, phoneRaw: unknown, token: unknown): Promise<string> {
  const phone = normalizePhone(String(phoneRaw ?? ""));
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");
  if (user?.phone) {
    if (phone !== user.phone) throw new BookingError("Use the WhatsApp number on your account. To use another number, sign in with the Google account it belongs to.", 403);
    return phone;
  }
  await requireVerifiedPhone(token, phone);
  if (user) {
    const db = requireDb();
    const [other] = await db
      .select({ id: s.users.id })
      .from(s.users)
      .where(and(eq(s.users.phone, phone), ne(s.users.id, user.id)))
      .limit(1);
    if (other) throw new BookingError("This number belongs to another Google account. Sign in with that account, or use your own number.", 409);
    await db.update(s.users).set({ phone }).where(eq(s.users.id, user.id));
    user.phone = phone;
  }
  return phone;
}

/** Saves (or updates) the person after Google sign-in; returns their id, or null if they're blocked. */
export async function upsertGoogleUser(p: { sub: string; email: string; name: string; picture: string | null }) {
  const db = requireDb();
  const [u] = await db
    .insert(s.users)
    .values({ googleSub: p.sub, email: p.email, name: p.name, picture: p.picture })
    .onConflictDoUpdate({ target: s.users.googleSub, set: { email: p.email, name: p.name, picture: p.picture, lastSeenAt: new Date() } })
    .returning();
  return u.blockedAt ? null : u.id;
}

/** "My account": rides they offer, and upcoming seats they booked, with each ride's route. */
export async function myTrips(u: s.User) {
  const db = requireDb();
  const rides = await db
    .select()
    .from(s.rides)
    .where(u.phone ? or(eq(s.rides.driverPhone, u.phone), eq(s.rides.userId, u.id)) : eq(s.rides.userId, u.id))
    .orderBy(desc(s.rides.createdAt))
    .limit(50);
  const bookings = u.phone
    ? await db
        .select({ ride: s.rides, booking: s.rideBookings })
        .from(s.rideBookings)
        .innerJoin(s.rides, eq(s.rides.id, s.rideBookings.rideId))
        .where(and(eq(s.rideBookings.phone, u.phone), gte(s.rideBookings.date, todayLocal())))
        .orderBy(asc(s.rideBookings.date))
        .limit(50)
    : [];
  const ids = [...new Set([...rides.map((r) => r.id), ...bookings.map((b) => b.ride.id)])];
  const pts = ids.length ? await db.select().from(s.ridePoints).where(inArray(s.ridePoints.rideId, ids)).orderBy(asc(s.ridePoints.idx)) : [];
  const route = (id: number) => pts.filter((p) => p.rideId === id).map((p) => p.name);
  return {
    rides: rides.map((r) => ({ ride: r, route: route(r.id) })),
    bookings: bookings.map((b) => {
      const names = route(b.ride.id);
      return { ride: b.ride, booking: b.booking, from: names[b.booking.pickupIdx] ?? "", to: names[b.booking.dropIdx] ?? "" };
    }),
  };
}
