import Link from "next/link";
import { headers } from "next/headers";
import { desc, asc, eq, gte, lt, sql } from "drizzle-orm";
import { ChevronRight, Plus } from "lucide-react";
import { CopyButton } from "@/components/admin/CopyButton";
import { requireDb, schema as s } from "@/lib/db";
import { DIRECTION_LABEL, formatDate, todayLocal } from "@/lib/format";
import { seatList } from "@/lib/layout";
import { siteUrl } from "@/lib/url";
import { closedReason } from "@/lib/trips";

export const metadata = { title: "Trips" };

async function tripsWithCounts(upcoming: boolean) {
  const today = todayLocal();
  return requireDb()
    .select({ trip: s.trips, booked: sql<number>`count(${s.bookings.id})::int` })
    .from(s.trips)
    .leftJoin(s.bookings, eq(s.bookings.tripId, s.trips.id))
    .where(upcoming ? gte(s.trips.date, today) : lt(s.trips.date, today))
    .groupBy(s.trips.id)
    .orderBy(upcoming ? asc(s.trips.date) : desc(s.trips.date), asc(s.trips.direction))
    .limit(upcoming ? 100 : 20);
}

export default async function TripsPage() {
  const [upcoming, past, base] = await Promise.all([tripsWithCounts(true), tripsWithCounts(false), Promise.resolve(siteUrl(await headers()))]);
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Trips</h1>
        <Link href="/admin/trips/new" className="btn-primary">
          <Plus className="size-4" /> New trip
        </Link>
      </div>

      <TripList rows={upcoming} base={base} empty="No upcoming trips. Create one and share its link in the WhatsApp group." />

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold text-slate-600">Past trips</h2>
          <TripList rows={past} base={base} />
        </>
      )}
    </>
  );
}

function TripList({ rows, base, empty }: { rows: Awaited<ReturnType<typeof tripsWithCounts>>; base: string; empty?: string }) {
  if (!rows.length) return empty ? <p className="card text-center text-slate-600">{empty}</p> : null;
  return (
    <ul className="space-y-3">
      {rows.map(({ trip, booked }) => {
        const total = seatList(trip.layout).length;
        const closed = closedReason(trip);
        return (
          <li key={trip.id} className="card flex flex-wrap items-center gap-4 !p-4">
            <Link href={`/admin/trips/${trip.id}`} className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className={trip.direction === "to_uni" ? "text-brand" : "text-amber-700"}>{DIRECTION_LABEL[trip.direction]}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{formatDate(trip.date)}</span>
                <span className={`rounded-full px-2 py-0.5 ${closed ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-800"}`}>
                  {closed ? "Closed" : "Open"}
                </span>
              </div>
              <div className="mt-1 truncate font-semibold">{trip.title}</div>
            </Link>
            <div className="text-right text-sm">
              <div className="font-bold">
                {booked}/{total}
              </div>
              <div className="text-xs text-slate-500">booked</div>
            </div>
            <CopyButton text={`${base}/t/${trip.slug}`} label="Copy link" />
            <Link href={`/admin/trips/${trip.id}`} className="text-slate-400 hover:text-ink" aria-label="Open trip">
              <ChevronRight className="size-5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
