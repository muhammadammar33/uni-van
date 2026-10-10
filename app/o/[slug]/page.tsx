import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { ArrowRight, CalendarDays, Lock, MapPin, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { db, schema as s } from "@/lib/db";
import { displayPhone, formatDateRange, formatFare, formatTime, todayLocal } from "@/lib/format";
import { fareRange, seatList } from "@/lib/layout";
import { orgInfo } from "@/lib/orgTypes";
import { closedReason } from "@/lib/trips";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!db) return null;
  const [org] = await db.select().from(s.organizations).where(eq(s.organizations.slug, slug)).limit(1);
  if (!org) return null;
  const trips = await db
    .select({ trip: s.trips, booked: sql<number>`(select count(*)::int from ${s.bookings} where ${s.bookings.tripId} = ${s.trips.id})` })
    .from(s.trips)
    .where(and(eq(s.trips.orgId, org.id), eq(s.trips.status, "open"), sql`${s.trips.date} >= ${todayLocal()}`))
    .orderBy(asc(s.trips.date), asc(s.trips.departTime))
    .limit(60);
  const open = trips.filter((t) => !closedReason(t.trip, org));
  const stops = open.length
    ? await db
        .select()
        .from(s.stops)
        .where(inArray(s.stops.tripId, open.map((t) => t.trip.id)))
        .orderBy(asc(s.stops.sortOrder), asc(s.stops.time))
    : [];
  return { org, trips: open.map((t) => ({ ...t, stops: stops.filter((st) => st.tripId === t.trip.id) })) };
}

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Not found" };
  return { title: data.org.name, description: `Book your seat with ${data.org.name}: ${data.trips.length} trips open for booking.` };
}

export default async function OrgPublicPage({ params }: PageProps<"/o/[slug]">) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const { org, trips } = data;
  const info = orgInfo(org.type);

  return (
    <div className="min-h-dvh">
      <header className="bg-hero relative overflow-hidden px-4 pb-16 pt-6 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative mx-auto max-w-3xl">
          <Link href="/" className="inline-block opacity-80 hover:opacity-100">
            <Logo light />
          </Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-wider text-accent">
            {info.emoji} {info.label}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{org.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-teal-50/90">
            {org.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {org.city}
              </span>
            )}
            {org.phone && (
              <>
                <a href={`tel:+${org.phone}`} className="flex items-center gap-1.5 hover:text-white">
                  <Phone className="size-4" /> {displayPhone(org.phone)}
                </a>
                <a href={`https://wa.me/${org.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 max-w-3xl px-4 pb-16">
        {!org.active ? (
          <p className="card text-center text-slate-600">Booking with {org.name} isn&apos;t available right now.</p>
        ) : trips.length === 0 ? (
          <p className="card text-center text-slate-600">No trips open for booking right now. Check back soon, or watch for the link in your WhatsApp group.</p>
        ) : (
          <>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/90 drop-shadow">
              {trips.length} {info.multiDay ? (trips.length === 1 ? "tour" : "tours") : trips.length === 1 ? "trip" : "trips"} open for booking
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              {trips.map(({ trip, booked, stops }) => {
                const total = seatList(trip.layout).length;
                const left = total - booked;
                const fares = fareRange(trip.layout, trip.fare);
                return (
                  <li key={trip.id} className="min-w-0">
                    <Link href={`/t/${trip.slug}`} className="card group flex h-full flex-col !p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                      <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide">
                        <span className={trip.direction === "to_uni" ? "text-brand" : "text-amber-700"}>{info.direction[trip.direction]}</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <CalendarDays className="size-3.5" /> {formatDateRange(trip.date, trip.endDate)}
                        </span>
                      </div>
                      <div className="mt-2 break-words text-lg font-bold leading-snug group-hover:text-brand">{trip.title}</div>
                      {stops[0] && (
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
                          <MapPin className="size-4 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {stops[0].name} · {formatTime(stops[0].time)}
                            {stops.length > 1 ? ` (+${stops.length - 1} more ${stops.length === 2 ? "stop" : "stops"})` : ""}
                          </span>
                        </div>
                      )}
                      {trip.notes && info.multiDay && <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-slate-500">{trip.notes}</p>}
                      <div className="mt-auto pt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand to-teal-400" style={{ width: `${Math.round((booked / Math.max(total, 1)) * 100)}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className={left <= 3 ? "font-semibold text-amber-700" : "text-slate-600"}>{left === 0 ? "Full" : `${left} of ${total} seats left`}</span>
                          {fares && <span className="font-bold">{fares.min === fares.max ? formatFare(fares.min) : `from ${formatFare(fares.min)}`}</span>}
                        </div>
                        <span className="mt-3 flex items-center justify-between text-sm font-semibold text-brand">
                          {trip.membersOnly ? (
                            <span className="flex items-center gap-1 text-violet-700">
                              <Lock className="size-3.5" /> Registered {info.riders} only
                            </span>
                          ) : (
                            <span>{trip.maxSeats > 1 ? `Book up to ${trip.maxSeats} seats` : "Book a seat"}</span>
                          )}
                          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="mt-10 text-center text-xs text-slate-400">
          Seat booking by{" "}
          <Link href="/" className="font-semibold hover:text-ink">
            {BRAND.name}
          </Link>
        </p>
      </main>
    </div>
  );
}
