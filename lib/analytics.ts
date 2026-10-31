import "server-only";
import { createHash } from "node:crypto";
import { and, gte, inArray, sql } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";
import { addDays } from "@/lib/schedule";
import { todayLocal } from "@/lib/format";

/* ---------- Counting (privacy-friendly: daily totals and a one-way visitor code, never an IP address) ---------- */

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse/i;

/** Which section a page belongs to ("/r/abc123" → "/r"), so counts don't grow with every ride link. */
export function section(path: string) {
  const p = path.split("?")[0];
  if (p === "/") return "/";
  if (p.startsWith("/r/manage")) return "/r/manage";
  return `/${p.split("/")[1] ?? ""}`.slice(0, 40);
}

async function bump(day: string, metric: string, key: string) {
  await requireDb()
    .insert(s.usageDaily)
    .values({ day, metric, key: key.slice(0, 120), count: 1 })
    .onConflictDoUpdate({ target: [s.usageDaily.day, s.usageDaily.metric, s.usageDaily.key], set: { count: sql`${s.usageDaily.count} + 1` } });
}

/** A page view from the browser. Admin pages and bots aren't counted. */
export async function trackView(path: string, h: Headers) {
  const ua = h.get("user-agent") ?? "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api") || BOT.test(ua)) return;
  const day = todayLocal();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  // Changes every day and can't be turned back into the address.
  const hash = createHash("sha256").update(`${day}|${ip}|${ua}|${process.env.AUTH_SECRET ?? ""}`).digest("base64url").slice(0, 22);
  await Promise.all([bump(day, "view", section(path)), requireDb().insert(s.visitorDays).values({ day, hash }).onConflictDoNothing()]);
}

/** A search for a route (both ends chosen), and whether it found nothing: that's demand without rides. */
export async function trackSearch(from: string, to: string, kind: string, found: number) {
  const day = todayLocal();
  const key = `${from} → ${to}${kind === "intercity" ? " (intercity)" : ""}`;
  await bump(day, "search", key);
  if (!found) await bump(day, "search_empty", key);
}

/* ---------- The owner's dashboard ---------- */

const n = (v: unknown) => Number(v ?? 0);

export async function analytics(days: 7 | 30 | 90) {
  const db = requireDb();
  const today = todayLocal();
  const from = addDays(today, -(days - 1));
  const fromTs = `${from}T00:00:00+05:00`;
  const one = async <T,>(q: ReturnType<typeof sql>) => (await db.execute(q))[0] as T;

  const [totals, rangeTotals, perDay, routes, searches, empty, pages, kinds] = await Promise.all([
    one<Record<string, number>>(sql`select
      (select count(*) from users) as people,
      (select count(*) from identities where rider_status = 'approved' or driver_status = 'approved') as verified,
      (select count(*) from identities where driver_status = 'approved') as drivers,
      (select count(*) from identities where rider_status = 'pending' or driver_status = 'pending') as waiting,
      (select count(*) from rides) as rides,
      (select count(*) from rides where status = 'active') as rides_live,
      (select count(*) from ride_bookings) as bookings,
      (select coalesce(sum(seats), 0) from ride_bookings) as seats,
      (select count(distinct phone) from ride_bookings) as passengers,
      (select count(*) from ride_bookings where boarded_at is not null) as trips,
      (select coalesce(sum(count), 0) from usage_daily where metric = 'view') as views,
      (select count(*) from visitor_days) as visits`),
    one<Record<string, number>>(sql`select
      (select count(*) from users where created_at >= ${fromTs}) as people,
      (select count(*) from rides where created_at >= ${fromTs}) as rides,
      (select coalesce(sum(seats), 0) from ride_bookings where created_at >= ${fromTs}) as seats,
      (select count(distinct phone) from ride_bookings where created_at >= ${fromTs}) as passengers,
      (select count(*) from ride_bookings where boarded_at >= ${fromTs}) as trips,
      (select count(*) from visitor_days where day >= ${from}) as visits,
      (select coalesce(sum(count), 0) from usage_daily where metric = 'view' and day >= ${from}) as views,
      (select count(*) from wa_messages where direction = 'in' and created_at >= ${fromTs}) as messages,
      (select count(*) from feedback where created_at >= ${fromTs}) as feedback`),
    db.execute<{ day: string; visitors: number; people: number; rides: number; seats: number }>(sql`
      with d as (select to_char(g, 'YYYY-MM-DD') as day from generate_series(${from}::date, ${today}::date, interval '1 day') g)
      select d.day,
        (select count(*) from visitor_days v where v.day = d.day)::int as visitors,
        (select count(*) from users u where to_char(u.created_at at time zone 'Asia/Karachi', 'YYYY-MM-DD') = d.day)::int as people,
        (select count(*) from rides r where to_char(r.created_at at time zone 'Asia/Karachi', 'YYYY-MM-DD') = d.day)::int as rides,
        (select coalesce(sum(b.seats), 0) from ride_bookings b where to_char(b.created_at at time zone 'Asia/Karachi', 'YYYY-MM-DD') = d.day)::int as seats
      from d order by d.day`),
    db.execute<{ route: string; seats: number }>(sql`
      select p1.name || ' → ' || p2.name as route, sum(b.seats)::int as seats
      from ride_bookings b
      join ride_points p1 on p1.ride_id = b.ride_id and p1.idx = b.pickup_idx
      join ride_points p2 on p2.ride_id = b.ride_id and p2.idx = b.drop_idx
      where b.created_at >= ${fromTs}
      group by 1 order by 2 desc limit 8`),
    db
      .select({ key: s.usageDaily.key, count: sql<number>`sum(${s.usageDaily.count})::int` })
      .from(s.usageDaily)
      .where(and(gte(s.usageDaily.day, from), inArray(s.usageDaily.metric, ["search"])))
      .groupBy(s.usageDaily.key)
      .orderBy(sql`2 desc`)
      .limit(8),
    db
      .select({ key: s.usageDaily.key, count: sql<number>`sum(${s.usageDaily.count})::int` })
      .from(s.usageDaily)
      .where(and(gte(s.usageDaily.day, from), inArray(s.usageDaily.metric, ["search_empty"])))
      .groupBy(s.usageDaily.key)
      .orderBy(sql`2 desc`)
      .limit(8),
    db
      .select({ key: s.usageDaily.key, count: sql<number>`sum(${s.usageDaily.count})::int` })
      .from(s.usageDaily)
      .where(and(gte(s.usageDaily.day, from), inArray(s.usageDaily.metric, ["view"])))
      .groupBy(s.usageDaily.key)
      .orderBy(sql`2 desc`)
      .limit(8),
    one<{ city: number; intercity: number }>(sql`select count(*) filter (where kind = 'city') as city, count(*) filter (where kind = 'intercity') as intercity from rides`),
  ]);
  const num = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, n(v)])) as Record<string, number>;
  return {
    days,
    from,
    totals: num(totals),
    range: num(rangeTotals),
    perDay: [...perDay].map((r) => ({ day: r.day, visitors: n(r.visitors), people: n(r.people), rides: n(r.rides), seats: n(r.seats) })),
    routes: [...routes].map((r) => ({ label: r.route, value: n(r.seats) })),
    searches: searches.map((r) => ({ label: r.key, value: n(r.count) })),
    empty: empty.map((r) => ({ label: r.key, value: n(r.count) })),
    pages: pages.map((r) => ({ label: PAGE_NAMES[r.key] ?? r.key, value: n(r.count) })),
    kinds: { city: n(kinds.city), intercity: n(kinds.intercity) },
  };
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Home",
  "/search": "Search",
  "/r": "Ride pages",
  "/r/manage": "Drivers' ride pages",
  "/offer": "Offer a ride",
  "/me": "My account",
  "/welcome": "Account setup",
  "/signin": "Sign in",
  "/feedback": "Feedback",
  "/privacy": "Privacy",
  "/terms": "Terms",
};
