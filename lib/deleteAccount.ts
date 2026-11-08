import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";

/**
 * A person deletes their Hamsafar account (Google Play and Apple require this to be possible in the app and on
 * the web). Removed: their rides (with those rides' bookings and live location), their bookings, reviews they
 * wrote and reviews about them, their ID and ID photos, phone checks and WhatsApp chats with the team.
 * Kept: an organisation's own records (its student/staff list and van bookings), and, for someone who was
 * blocked, a bare record (their Google ID and number, nothing else) so the block still holds.
 */
export async function deleteAccount(userId: number) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [u] = await tx.select().from(s.users).where(eq(s.users.id, userId)).for("update");
    if (!u) return false;
    const phone = u.phone;
    const rides = await tx
      .select({ id: s.rides.id })
      .from(s.rides)
      .where(phone ? or(eq(s.rides.userId, userId), eq(s.rides.driverPhone, phone)) : eq(s.rides.userId, userId));
    if (rides.length) await tx.delete(s.rides).where(inArray(s.rides.id, rides.map((r) => r.id)));
    await tx.delete(s.rideBookings).where(phone ? or(eq(s.rideBookings.userId, userId), eq(s.rideBookings.phone, phone)) : eq(s.rideBookings.userId, userId));
    await tx.delete(s.appSignIns).where(eq(s.appSignIns.userId, userId));
    if (phone) {
      await tx.delete(s.driverReviews).where(or(eq(s.driverReviews.riderPhone, phone), eq(s.driverReviews.driverPhone, phone)));
      await tx.delete(s.identities).where(eq(s.identities.phone, phone));
      await tx.delete(s.phoneVerifications).where(eq(s.phoneVerifications.phone, phone));
      await tx.delete(s.waMessages).where(eq(s.waMessages.waId, phone));
    }
    if (u.blockedAt) {
      // Blocked: keep only what keeps the block working (Google ID and number), not their name or email.
      await tx.update(s.users).set({ name: "Deleted account", email: `deleted-${u.id}@deleted.invalid`, picture: null }).where(eq(s.users.id, userId));
    } else {
      await tx.delete(s.users).where(eq(s.users.id, userId));
    }
    return true;
  });
}
