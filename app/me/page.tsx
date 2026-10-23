import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, Car, LogOut, Phone, Plus, Ticket } from "lucide-react";
import { Logo } from "@/components/Logo";
import { currentUser, myTrips } from "@/lib/account";
import { displayPhone, formatDate, formatTime, todayLocal } from "@/lib/format";
import { identityByPhone } from "@/lib/identity";
import { describeSchedule } from "@/lib/schedule";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My account", robots: { index: false } };

const STATUS: Record<string, [string, string]> = {
  active: ["Live", "bg-emerald-50 text-emerald-700"],
  pending: ["Waiting for ID check", "bg-amber-50 text-amber-800"],
  paused: ["Paused", "bg-slate-100 text-slate-600"],
  cancelled: ["Cancelled", "bg-red-50 text-red-700"],
};
const ID_LABEL: Record<string, string> = { none: "Not sent yet", pending: "Being checked (within 24 hours)", approved: "Verified", rejected: "Not approved: send it again" };

/** The signed-in rider/driver: their details, rides they offer and seats they booked, on any phone. */
export default async function MePage() {
  const u = await currentUser();
  if (!u) redirect("/signin?next=/me");
  const [{ rides, bookings }, ident] = await Promise.all([myTrips(u), u.phone ? identityByPhone(u.phone) : null]);
  const today = todayLocal();
  return (
    <div className="min-h-dvh pb-16">
      <header className="bg-hero px-4 pb-16 pt-4 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-2xl font-bold ring-2 ring-white/30">
              {u.picture ? (
                // eslint-disable-next-line @next/next/no-img-element -- Google profile picture
                <img src={u.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
              ) : (
                u.name.slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{u.name}</h1>
              <p className="truncate text-teal-50/90">{u.email}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto -mt-10 max-w-2xl space-y-4 px-4">
        <section className="card divide-y divide-slate-100 !py-2">
          <div className="flex items-center gap-3 py-3">
            <Phone className="size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-500">WhatsApp number</div>
              <div className="font-semibold">{u.phone ? displayPhone(u.phone) : "Not added yet: it's checked the first time you offer or book a ride"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 py-3">
            <BadgeCheck className="size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-500">ID check</div>
              <div className="font-semibold">
                {!ident ? "Not sent yet: asked the first time you offer or book" : ident.driverStatus !== "none" ? `Driver: ${ID_LABEL[ident.driverStatus]}` : `Rider: ${ID_LABEL[ident.riderStatus]}`}
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Ticket className="size-5 text-brand" /> My bookings
            </h2>
            <Link href="/search" className="text-sm font-semibold text-brand">
              Find a ride
            </Link>
          </div>
          {bookings.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">No upcoming bookings.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {bookings.map(({ ride, booking, from, to }) => (
                <li key={booking.id}>
                  <Link href={`/r/${ride.slug}`} className="flex items-center gap-3 py-3">
                    <div className="w-14 shrink-0 text-center">
                      <div className="text-xs font-bold uppercase text-brand">{booking.date === today ? "Today" : formatDate(booking.date)}</div>
                      <div className="text-sm font-extrabold">{formatTime(ride.departTime)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {from} → {to}
                      </div>
                      <div className="text-xs text-slate-500">
                        {ride.driverName.split(" ")[0]} · {ride.car} · code <span className="font-mono font-bold">{booking.code}</span>
                        {booking.boardedAt && " · on board ✓"}
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Car className="size-5 text-brand" /> Rides I offer
            </h2>
            <Link href="/offer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
              <Plus className="size-4" /> Offer a ride
            </Link>
          </div>
          {rides.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">None yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rides.map(({ ride, route }) => {
                const [label, cls] = STATUS[ride.status] ?? [ride.status, "bg-slate-100"];
                return (
                  <li key={ride.id}>
                    <Link href={`/r/manage/${ride.manageToken}`} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">
                          {route[0]} → {route[route.length - 1]}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          <span>
                            {formatTime(ride.departTime)} · {describeSchedule({ kind: ride.schedule, date: ride.date, days: ride.days, until: ride.until })}
                          </span>
                          <span className={`rounded-full px-2 font-bold ${cls}`}>{label}</span>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-brand">Manage</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form action="/api/auth/logout" method="post">
          <button className="btn-ghost w-full">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
