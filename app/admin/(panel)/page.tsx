import Link from "next/link";
import { headers } from "next/headers";
import { asc, desc, gte, inArray, lt } from "drizzle-orm";
import { ArrowRight, Bus, CalendarPlus, ChevronRight, MapPin, Plus } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { WhatsAppShareButton } from "@/components/admin/WhatsAppShareButton";
import { requireAdmin } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { DIRECTION_LABEL, formatDate, formatFare, formatTime, nowLocal, todayLocal } from "@/lib/format";
import { seatList } from "@/lib/layout";
import { closedReason } from "@/lib/trips";
import { tripShareMessage } from "@/lib/share";
import { siteUrl } from "@/lib/url";

export const metadata = { title: "Trips" };

async function loadTrips(upcoming: boolean) {
  const db = requireDb();
  const today = todayLocal();
  const trips = await db
    .select()
    .from(s.trips)
    .where(upcoming ? gte(s.trips.date, today) : lt(s.trips.date, today))
    .orderBy(upcoming ? asc(s.trips.date) : desc(s.trips.date), asc(s.trips.direction))
    .limit(upcoming ? 100 : 20);
  const ids = trips.map((t) => t.id);
  const [bookings, stops] = ids.length
    ? await Promise.all([
        db.select({ tripId: s.bookings.tripId, gender: s.bookings.gender, fare: s.bookings.fare, paid: s.bookings.paid }).from(s.bookings).where(inArray(s.bookings.tripId, ids)),
        db.select().from(s.stops).where(inArray(s.stops.tripId, ids)).orderBy(asc(s.stops.sortOrder), asc(s.stops.time)),
      ])
    : [[], []];
  return trips.map((trip) => {
    const mine = bookings.filter((b) => b.tripId === trip.id);
    const tripStops = stops.filter((st) => st.tripId === trip.id);
    return {
      trip,
      total: seatList(trip.layout).length,
      female: mine.filter((b) => b.gender === "female").length,
      male: mine.filter((b) => b.gender === "male").length,
      expected: mine.reduce((sum, b) => sum + (b.fare ?? 0), 0),
      collected: mine.reduce((sum, b) => sum + (b.paid ? (b.fare ?? 0) : 0), 0),
      stops: tripStops,
    };
  });
}
type Row = Awaited<ReturnType<typeof loadTrips>>[number];

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  const t = new Date(`${today}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  if (date === t.toISOString().slice(0, 10)) return "Tomorrow";
  return formatDate(date, true);
}

function greeting() {
  const h = Number(nowLocal().slice(11, 13));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function TripsPage() {
  const [admin, upcoming, past, h] = await Promise.all([requireAdmin(), loadTrips(true), loadTrips(false), headers()]);
  const base = siteUrl(h);
  const today = todayLocal();

  const booked = upcoming.reduce((n, r) => n + r.female + r.male, 0);
  const seats = upcoming.reduce((n, r) => n + r.total, 0);
  const expected = upcoming.reduce((n, r) => n + r.expected, 0);
  const collected = upcoming.reduce((n, r) => n + r.collected, 0);

  const days = new Map<string, Row[]>();
  for (const r of upcoming) days.set(r.trip.date, [...(days.get(r.trip.date) ?? []), r]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand">{formatDate(today, true)}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {greeting()}, {admin.name.split(" ")[0]} 👋
          </h1>
        </div>
        <Link href="/admin/trips/new" className="btn-primary px-5 py-3">
          <Plus className="size-4" /> New trip
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Seats booked" value={`${booked}/${seats}`} bar={seats ? booked / seats : 0} />
        <Stat label="Fares due" value={formatFare(expected)} />
        <Stat label="Collected" value={formatFare(collected)} tone="text-emerald-700" bar={expected ? collected / expected : 0} />
      </div>

      {upcoming.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 !py-14 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-brand-lt text-brand">
            <CalendarPlus className="size-8" />
          </span>
          <h2 className="text-lg font-bold">No upcoming trips</h2>
          <p className="max-w-sm text-slate-600">Create a trip, then share its link in the WhatsApp group. Students book their own seats.</p>
          <Link href="/admin/trips/new" className="btn-primary mt-2">
            Create your first trip <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {[...days].map(([date, rows]) => (
            <section key={date}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                {dayLabel(date, today)}
                {dayLabel(date, today) !== formatDate(date, true) && <span className="font-medium normal-case tracking-normal text-slate-400">· {formatDate(date)}</span>}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2">
                {rows.map((r) => (
                  <TripCard key={r.trip.id} row={r} base={base} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Past trips</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            {past.map(({ trip, female, male, total, collected }) => (
              <li key={trip.id}>
                <Link href={`/admin/trips/${trip.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                  <span className="w-24 shrink-0 text-slate-500">{formatDate(trip.date)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{trip.title}</span>
                  <span className="hidden text-slate-500 sm:inline">
                    {female + male}/{total} seats
                  </span>
                  {collected > 0 && <span className="hidden font-semibold text-emerald-700 sm:inline">{formatFare(collected)}</span>}
                  <ChevronRight className="size-4 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, tone = "", bar }: { label: string; value: React.ReactNode; tone?: string; bar?: number }) {
  return (
    <div className="card !p-4">
      <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 whitespace-nowrap text-xl font-extrabold tracking-tight sm:text-2xl ${tone}`}>{value}</div>
      {bar !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(Math.min(bar, 1) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function TripCard({ row, base }: { row: Row; base: string }) {
  const { trip, total, female, male, stops, expected, collected } = row;
  const booked = female + male;
  const closed = closedReason(trip);
  const url = `${base}/t/${trip.slug}`;
  const toHome = trip.direction === "to_home";
  const pct = (n: number) => `${(n / Math.max(total, 1)) * 100}%`;
  const shareText = tripShareMessage(trip, stops, url);
  return (
    <li className="card group relative flex min-w-0 flex-col !p-0 transition hover:shadow-lift">
      <Link href={`/admin/trips/${trip.id}`} className="block p-5 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              toHome ? "bg-amber-100 text-amber-800" : "bg-brand-lt text-brand-dk"
            }`}
          >
            <Bus className="size-3.5" /> {DIRECTION_LABEL[trip.direction]}
          </span>
          <span className={`text-xs font-bold ${closed ? "text-slate-400" : "text-emerald-600"}`}>{closed ? "● Closed" : "● Open"}</span>
        </div>
        <h3 className="mt-2 break-words text-lg font-bold leading-snug group-hover:text-brand">{trip.title}</h3>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{stops.length ? `${stops[0].name} ${formatTime(stops[0].time)}${stops.length > 1 ? ` → ${stops.at(-1)!.name}` : ""}` : "No stops yet"}</span>
        </p>

        <div className="mt-4 flex items-end justify-between text-sm">
          <span>
            <b className="text-xl font-extrabold">{booked}</b>
            <span className="text-slate-500">/{total} booked</span>
          </span>
          {expected > 0 && (
            <span className="text-slate-500">
              <b className="text-emerald-700">{formatFare(collected)}</b> / {formatFare(expected)}
            </span>
          )}
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" title={`${female} female, ${male} male`}>
          <div className="h-full bg-female/70" style={{ width: pct(female) }} />
          <div className="h-full bg-male/70" style={{ width: pct(male) }} />
        </div>
        <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-female/70" /> {female} female
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-male/70" /> {male} male
          </span>
          <span className="ml-auto">{total - booked} free</span>
        </div>
      </Link>
      <div className="mt-auto flex gap-2 border-t border-slate-100 px-5 py-3">
        <WhatsAppShareButton text={shareText} />
        <CopyButton text={url} label="Copy link" className="btn-ghost flex-1 !py-2" />
      </div>
    </li>
  );
}
