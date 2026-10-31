import Link from "next/link";
import { DailyColumns, RankedBars } from "@/components/admin/Charts";
import { analytics } from "@/lib/analytics";
import { requireSuper } from "@/lib/auth";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const fmt = (v: number) => v.toLocaleString("en-US");

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card !p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight">{typeof value === "number" ? fmt(value) : value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

/** Super admin: how Hamsafar is used: people, rides, passengers, visits, and where people want rides. */
export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireSuper();
  const sp = await searchParams;
  const days = sp.days === "7" ? 7 : sp.days === "90" ? 90 : 30;
  const a = await analytics(days);
  const t = a.totals;
  const r = a.range;
  const inRange = (v: number) => `${v > 0 ? "+" : ""}${fmt(v)} in the last ${days} days`;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Analytics</h1>
      <p className="mt-1 text-sm text-slate-600">How Hamsafar is used. Totals are since the start; charts and lists cover the period you choose.</p>
      <div className="mt-4 flex flex-wrap gap-1 text-sm font-semibold" role="group" aria-label="Period">
        {([7, 30, 90] as const).map((d) => (
          <Link key={d} href={`/admin/analytics?days=${d}`} aria-current={d === days ? "true" : undefined} className={`rounded-lg px-3 py-1.5 ${d === days ? "bg-ink text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-ink"}`}>
            Last {d} days
          </Link>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">People</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Signed up" value={t.people} sub={inRange(r.people)} />
        <Tile label="ID verified" value={t.verified} />
        <Tile label="Verified drivers" value={t.drivers} />
        <Tile label="IDs waiting for you" value={t.waiting} />
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">Rides & passengers</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Rides offered" value={t.rides} sub={`${inRange(r.rides)} · ${fmt(a.kinds.city)} city, ${fmt(a.kinds.intercity)} intercity`} />
        <Tile label="Live now" value={t.rides_live} />
        <Tile label="Seats booked" value={t.seats} sub={inRange(r.seats)} />
        <Tile label="Passengers" value={t.passengers} sub={`${fmt(r.passengers)} in the last ${days} days`} />
        <Tile label="Trips completed" value={t.trips} sub={`Rider entered the ride code · ${inRange(r.trips)}`} />
        <Tile label="Bookings" value={t.bookings} />
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">Platform usage</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Visitors" value={r.visits} sub={`in the last ${days} days · ${fmt(t.visits)} since counting began`} />
        <Tile label="Page views" value={r.views} sub={`in the last ${days} days`} />
        <Tile label="WhatsApp messages" value={r.messages} sub={`received in the last ${days} days`} />
        <Tile label="Feedback" value={r.feedback} sub={`in the last ${days} days`} />
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">Per day</h2>
      <div className="mt-2 grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <DailyColumns title="Visitors" unit="visitors" data={a.perDay.map((d) => ({ day: d.day, value: d.visitors }))} />
        <DailyColumns title="New sign-ups" unit="people" data={a.perDay.map((d) => ({ day: d.day, value: d.people }))} />
        <DailyColumns title="Rides offered" unit="rides" data={a.perDay.map((d) => ({ day: d.day, value: d.rides }))} />
        <DailyColumns title="Seats booked" unit="seats" data={a.perDay.map((d) => ({ day: d.day, value: d.seats }))} />
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-slate-500">Where people go</h2>
      <div className="mt-2 grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        <RankedBars title="Most booked routes" unit="seats" items={a.routes} empty="No bookings in this period." />
        <RankedBars
          title="Searched, but no ride found"
          note="Demand without drivers: invite drivers on these routes."
          unit="searches"
          items={a.empty}
          empty="No empty searches in this period."
        />
        <RankedBars title="Most searched routes" unit="searches" items={a.searches} empty="No searches in this period." />
        <RankedBars title="Most visited pages" unit="views" items={a.pages} empty="No visits counted in this period." />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Visits are counted privately on Hamsafar itself: daily totals and a code that changes every day, never an IP address or anything shared with others. Admin pages
        and search-engine bots aren&apos;t counted.
      </p>
    </>
  );
}
