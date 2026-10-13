import Link from "next/link";
import { ExternalLink, Settings2 } from "lucide-react";
import { requireSuper } from "@/lib/auth";
import { displayPhone, formatTime } from "@/lib/format";
import { allRides } from "@/lib/rides";
import { describeSchedule } from "@/lib/schedule";

export const metadata = { title: "Carpool rides" };

/** Super admin: every carpool ride, to check and stop abusive or fake ones. */
export default async function RidesAdminPage() {
  await requireSuper();
  const rows = await allRides();
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Carpool rides</h1>
      <p className="mb-5 text-sm text-slate-500">Every ride offered on the site (newest first). Open a ride&apos;s driver page to pause or cancel it.</p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        {rows.map(({ ride, points }) => (
          <li key={ride.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {points[0]?.name} → {points[points.length - 1]?.name}
              </div>
              <div className="truncate text-xs text-slate-500">
                {ride.driverName} · {displayPhone(ride.driverPhone)} · {ride.car} · {formatTime(ride.departTime)} ·{" "}
                {describeSchedule({ kind: ride.schedule, date: ride.date, days: ride.days, until: ride.until })}
              </div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ride.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{ride.status}</span>
            <Link href={`/r/${ride.slug}`} className="p-1.5 text-slate-400 hover:text-ink" title="Public page" target="_blank">
              <ExternalLink className="size-4" />
            </Link>
            <Link href={`/r/manage/${ride.manageToken}`} className="btn-ghost !px-3 !py-1.5" target="_blank">
              <Settings2 className="size-4" /> Manage
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-center text-slate-500">No rides yet.</li>}
      </ul>
    </>
  );
}
