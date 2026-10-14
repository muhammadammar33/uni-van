import Link from "next/link";
import { ArrowRight, Car, Footprints, Users } from "lucide-react";
import { RatingBadge, VerifiedBadge } from "@/components/carpool/Stars";
import { GenderIcon } from "@/components/SeatMap";
import { formatDate, formatFare, formatTime, todayLocal } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { addDays, describeSchedule } from "@/lib/schedule";
import type { PublicRide } from "@/lib/rides";

function dayWord(d: string) {
  const today = todayLocal();
  return d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : formatDate(d);
}

/** A ride in search results / lists. With pickup/drop indexes, shows the rider's part of the route. */
export function RideCard({ ride, pickupIdx, dropIdx, pickupKm, href }: { ride: PublicRide; pickupIdx?: number; dropIdx?: number; pickupKm?: number; href: string }) {
  const pts = ride.points;
  const a = pickupIdx ?? 0;
  const b = dropIdx ?? pts.length - 1;
  const next = ride.runs.find((r) => r.left > 0) ?? ride.runs[0];
  return (
    <Link href={href} className="card group flex h-full min-w-0 flex-col !p-4 transition hover:-translate-y-0.5 hover:shadow-lift sm:!p-5">
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-lg font-extrabold leading-none">{formatTime(ride.departTime)}</div>
          {next && <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand">{dayWord(next.date)}</div>}
        </div>
        <div className="min-w-0 flex-1 border-l border-slate-100 pl-3">
          <div className="font-bold leading-snug [overflow-wrap:anywhere]">
            {pts[a]?.name}
            <ArrowRight className="mx-1 inline size-4 align-[-3px] text-slate-400" />
            {pts[b]?.name}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {pts.length > 2 || a > 0 || b < pts.length - 1 ? `Route: ${pts[0].name} → ${pts[pts.length - 1].name} · ` : ""}
            {describeSchedule(ride.schedule)}
          </div>
        </div>
        {ride.fare !== null ? <div className="shrink-0 text-right font-extrabold">{formatFare(ride.fare)}</div> : <div className="shrink-0 text-xs font-bold text-emerald-700">Free</div>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <span className="flex items-center gap-1.5 font-medium text-ink">
          <GenderIcon gender={ride.driverGender} className={`size-4 ${ride.driverGender === "female" ? "text-female" : "text-male"}`} /> {ride.driverName}
          {ride.verified && <VerifiedBadge compact />}
          {ride.rating && <RatingBadge rating={ride.rating} className="ml-0.5" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Car className="size-4 shrink-0" /> <span className="truncate">{ride.car}</span>
        </span>
        {next && (
          <span className={`flex items-center gap-1.5 ${next.left <= 1 ? "font-semibold text-amber-700" : ""}`}>
            <Users className="size-4" /> {next.left === 0 ? "Full" : `${next.left} seat${next.left === 1 ? "" : "s"} left`}
          </span>
        )}
        {ride.kind === "intercity" && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">Between cities</span>}
        {pickupKm !== undefined && pickupKm > 0.15 && ride.kind === "city" && (
          <span className="flex items-center gap-1.5">
            <Footprints className="size-4" /> {formatKm(pickupKm)} from you
          </span>
        )}
        {ride.riders !== "anyone" && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ride.riders === "female" ? "bg-female-lt text-female" : "bg-male-lt text-male"}`}>
            {ride.riders === "female" ? "Women only" : "Men only"}
          </span>
        )}
      </div>
    </Link>
  );
}
