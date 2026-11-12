import "server-only";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";
import { MATCH_RADIUS_KM, RIDE_KINDS, type RideKind } from "@/lib/cities";
import { matchRoute, matchStops } from "@/lib/geo";
import { formatTime } from "@/lib/format";
import { decodePoint } from "@/lib/places";
import { pushToUsers } from "@/lib/push";
import { describeSchedule, type Schedule } from "@/lib/schedule";
import { BookingError } from "@/lib/trips";
import { logError } from "@/lib/api";

/**
 * "Notify me": instead of a dead end when a search finds nothing, a signed-in rider saves the route and gets an
 * app notification when a ride is offered (or goes live) on it. Alerts end after ROUTE_ALERT_DAYS.
 */
export const ROUTE_ALERT_DAYS = 30;
const MAX_ALERTS = 5;

export async function addRouteAlert(user: s.User, raw: Record<string, unknown>) {
  const from = decodePoint(String(raw.from ?? ""));
  const to = decodePoint(String(raw.to ?? ""));
  if (!from || !to) throw new BookingError("Choose both a pickup and a drop-off first.");
  const kind: RideKind = (RIDE_KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as RideKind) : "city";
  const db = requireDb();
  const mine = await db
    .select()
    .from(s.routeAlerts)
    .where(and(eq(s.routeAlerts.userId, user.id), gt(s.routeAlerts.expiresAt, new Date())))
    .orderBy(asc(s.routeAlerts.createdAt));
  const expiresAt = new Date(Date.now() + ROUTE_ALERT_DAYS * 86400_000);
  const same = mine.find((a) => a.kind === kind && a.fromName === from.name && a.toName === to.name);
  if (same) {
    await db.update(s.routeAlerts).set({ expiresAt }).where(eq(s.routeAlerts.id, same.id));
    return { id: same.id };
  }
  // Keep the newest few: the oldest goes when a sixth is added.
  if (mine.length >= MAX_ALERTS) await db.delete(s.routeAlerts).where(eq(s.routeAlerts.id, mine[0].id));
  const [row] = await db
    .insert(s.routeAlerts)
    .values({ userId: user.id, kind, fromName: from.name, fromLat: from.lat, fromLng: from.lng, toName: to.name, toLat: to.lat, toLng: to.lng, expiresAt })
    .returning({ id: s.routeAlerts.id });
  return { id: row.id };
}

export async function myRouteAlerts(userId: number) {
  return requireDb()
    .select()
    .from(s.routeAlerts)
    .where(and(eq(s.routeAlerts.userId, userId), gt(s.routeAlerts.expiresAt, new Date())))
    .orderBy(desc(s.routeAlerts.createdAt));
}

export async function deleteRouteAlert(userId: number, id: number) {
  await requireDb()
    .delete(s.routeAlerts)
    .where(and(eq(s.routeAlerts.id, id), eq(s.routeAlerts.userId, userId)));
}

/** A ride was offered or went live: notify everyone whose saved route it serves (not the driver). */
export async function notifyRouteAlerts(rideIds: number[]) {
  if (!rideIds.length) return;
  try {
    const db = requireDb();
    const rides = await db
      .select()
      .from(s.rides)
      .where(and(inArray(s.rides.id, rideIds), eq(s.rides.status, "active")));
    for (const r of rides) {
      const pts = await db.select().from(s.ridePoints).where(eq(s.ridePoints.rideId, r.id)).orderBy(asc(s.ridePoints.idx));
      if (pts.length < 2) continue;
      const alerts = await db
        .select()
        .from(s.routeAlerts)
        .where(and(eq(s.routeAlerts.kind, r.kind), gt(s.routeAlerts.expiresAt, new Date())));
      const matcher = r.kind === "city" ? matchRoute : matchStops;
      const radius = MATCH_RADIUS_KM[r.kind];
      const hits = alerts.filter((a) => a.userId !== r.userId && matcher(pts, { lat: a.fromLat, lng: a.fromLng }, { lat: a.toLat, lng: a.toLng }, radius));
      const users = [...new Set(hits.map((a) => a.userId))];
      if (!users.length) continue;
      const when = `${describeSchedule({ kind: r.schedule, date: r.date, days: r.days, until: r.until } satisfies Schedule)} at ${formatTime(r.departTime)}`;
      await pushToUsers(users, {
        title: "A ride on your route",
        body: `${pts[0].name} → ${pts[pts.length - 1].name}, ${when}. Book a seat before it fills.`,
        url: `/r/${r.slug}`,
        tag: `alert-${r.id}`,
      });
    }
  } catch (err) {
    logError("route alerts", err);
  }
}
