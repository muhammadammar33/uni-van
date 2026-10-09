import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Armchair, Lock, LockOpen, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { CopyButton } from "@/components/admin/CopyButton";
import { AdminSeatPanel, DriverLinkBox, DuplicateForm, FlagToggle, RemoveBookingButton, ShareBox, type AdminBooking } from "@/components/admin/TripAdminClient";
import { GenderIcon } from "@/components/SeatMap";
import { DIRECTION_LABEL, displayPhone, formatDate, formatFare, formatTime } from "@/lib/format";
import { fareRange, findSeat, seatStats } from "@/lib/layout";
import { closedReason, loadTrip, takenSeats } from "@/lib/trips";
import { siteUrl } from "@/lib/url";
import { deleteTrip, setTripStatus } from "../../../actions";

export const metadata = { title: "Trip" };

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function TripAdminPage({ params }: PageProps<"/admin/trips/[id]">) {
  const id = Number((await params).id);
  const data = Number.isInteger(id) ? await loadTrip({ id }) : null;
  if (!data) notFound();
  const { trip, stops, bookings } = data;
  const toHome = trip.direction === "to_home";
  const base = siteUrl(await headers());
  const url = `${base}/t/${trip.slug}`;
  const driverUrl = `${base}/d/${trip.driverToken}`;
  const fares = fareRange(trip.layout, trip.fare);
  const closed = closedReason(trip);
  const stats = seatStats(trip.layout, takenSeats(bookings));

  const rows: AdminBooking[] = bookings.map((b) => ({
    id: b.id,
    seatId: b.seatId,
    seatLabel: findSeat(trip.layout, b.seatId)?.label ?? b.seatId,
    name: b.name,
    phone: b.phone,
    gender: b.gender,
    stopId: b.stopId,
    fare: b.fare,
    boarded: b.boarded,
    paid: b.paid,
  }));
  const expected = rows.reduce((sum, r) => sum + (r.fare ?? 0), 0);
  const collected = rows.reduce((sum, r) => sum + (r.paid ? (r.fare ?? 0) : 0), 0);
  const hasFares = rows.some((r) => r.fare !== null);
  const byStop = stops.map((st) => ({
    stop: st,
    passengers: rows.filter((r) => r.stopId === st.id).sort((a, b) => Number(a.seatLabel) - Number(b.seatLabel)),
  }));

  const stopWord = toHome ? "Drop-off" : "Pickup";
  const message = [
    `🚐 *${trip.title}*`,
    `📅 ${formatDate(trip.date, true)} · ${DIRECTION_LABEL[trip.direction]}`,
    trip.departTime ? `🕒 ${toHome ? "Leaves university at" : "Departs at"} ${formatTime(trip.departTime)}` : null,
    "",
    `${stopWord} points:`,
    ...stops.map((s) => `• ${s.name}: ${formatTime(s.time)}`),
    fares ? `\n💵 Fare: ${fares.min === fares.max ? formatFare(fares.min) : `${formatFare(fares.min)} to ${formatFare(fares.max)}`} per seat` : null,
    trip.notes ? `\n${trip.notes}` : null,
    "",
    `Book your seat 👉 ${url}`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  const passengerList = [
    `*${trip.title}*: ${formatDate(trip.date)}`,
    ...byStop
      .filter((g) => g.passengers.length)
      .flatMap((g) => ["", `📍 ${g.stop.name} (${formatTime(g.stop.time)})`, ...g.passengers.map((p) => `  Seat ${p.seatLabel}: ${p.name}, ${displayPhone(p.phone)}${p.fare !== null ? `, ${formatFare(p.fare)}` : ""}`)]),
  ].join("\n");

  const females = bookings.filter((b) => b.gender === "female").length;

  return (
    <>
      <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Trips
      </Link>

      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className={toHome ? "text-amber-700" : "text-brand"}>{DIRECTION_LABEL[trip.direction]}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">{formatDate(trip.date, true)}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${closed ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-800"}`}>
              {closed ? "Closed" : "Open for booking"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold">{trip.title}</h1>
          <p className="text-sm text-slate-500">
            {trip.vehicleName}
            {fares && ` · ${fares.min === fares.max ? formatFare(fares.min) : `${formatFare(fares.min)}–${formatFare(fares.max)}`} per seat`}
            {trip.closesAt && ` · booking stops ${formatDate(trip.closesAt.slice(0, 10))} ${formatTime(trip.closesAt.slice(11))}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/trips/${id}/edit`} className="btn-ghost">
            <Pencil className="size-4" /> Edit
          </Link>
          <Link href={`/admin/trips/${id}/seats`} className="btn-ghost">
            <Armchair className="size-4" /> Seating
          </Link>
          {trip.status === "open" ? (
            <ConfirmButton action={setTripStatus.bind(null, id, "closed")} confirm="Close booking for this trip?" className="btn-ghost">
              <Lock className="size-4" /> Close booking
            </ConfirmButton>
          ) : (
            <ConfirmButton action={setTripStatus.bind(null, id, "open")} className="btn-ghost">
              <LockOpen className="size-4" /> Reopen
            </ConfirmButton>
          )}
        </div>
      </div>
      {closed && trip.status === "open" && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{closed} Edit the date or closing time to reopen it.</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Booked" value={`${bookings.length}/${stats.total}`} />
        <Stat label="Female / male" value={`${females} / ${bookings.length - females}`} />
        <Stat label="Free for females" value={stats.freeFor.female} tone="text-female" />
        <Stat label="Free for males" value={stats.freeFor.male} tone="text-male" />
        {hasFares && (
          <>
            <Stat label="Fares expected" value={formatFare(expected)} />
            <Stat label="Collected" value={formatFare(collected)} tone="text-emerald-700" />
            <Stat label="Still to collect" value={formatFare(expected - collected)} />
          </>
        )}
        <Stat label="Boarded" value={`${rows.filter((r) => r.boarded).length}/${rows.length}`} />
      </div>

      <div className="space-y-5">
        <ShareBox url={url} message={message} />

        <DriverLinkBox tripId={id} url={driverUrl} title={trip.title} />

        <AdminSeatPanel tripId={id} layout={trip.layout} bookings={rows} stops={stops.map((s) => ({ id: s.id, name: s.name, time: s.time }))} toHome={toHome} />

        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Passengers by {stopWord.toLowerCase()} point</h2>
            {bookings.length > 0 && <CopyButton text={passengerList} label="Copy list" />}
          </div>
          <div className="space-y-4">
            {byStop.map(({ stop, passengers }) => (
              <div key={stop.id}>
                <div className="mb-1 flex items-baseline justify-between border-b border-slate-100 pb-1">
                  <span className="font-medium">{stop.name}</span>
                  <span className="text-sm text-slate-500">
                    {formatTime(stop.time)} · {passengers.length} {passengers.length === 1 ? "passenger" : "passengers"}
                  </span>
                </div>
                <ul>
                  {passengers.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="w-12 font-semibold text-slate-500">#{p.seatLabel}</span>
                      <GenderIcon gender={p.gender} className={`size-4 shrink-0 ${p.gender === "female" ? "text-female" : "text-male"}`} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {p.fare !== null && <span className="hidden text-slate-500 sm:inline">{formatFare(p.fare)}</span>}
                      <FlagToggle tripId={id} booking={p} field="boarded" label={toHome ? "Dropped" : "Boarded"} />
                      <FlagToggle tripId={id} booking={p} field="paid" label="Paid" />
                      <a href={`tel:+${p.phone}`} className="hidden text-slate-600 hover:text-ink sm:inline">
                        {displayPhone(p.phone)}
                      </a>
                      <a href={`https://wa.me/${p.phone}`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-[#25D366]" aria-label={`WhatsApp ${p.name}`}>
                        <MessageCircle className="size-4" />
                      </a>
                      <RemoveBookingButton tripId={id} bookingId={p.id} name={p.name} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <DuplicateForm tripId={id} nextDate={addDays(trip.date, 1)} returnLabel={DIRECTION_LABEL[toHome ? "to_uni" : "to_home"]} />
          <section className="card">
            <h2 className="mb-1 font-semibold">Delete trip</h2>
            <p className="mb-3 text-sm text-slate-500">Removes the trip, its stops and all bookings. The link stops working.</p>
            <ConfirmButton action={deleteTrip.bind(null, id)} confirm={`Delete "${trip.title}" and its ${bookings.length} bookings?`} className="btn-danger">
              <Trash2 className="size-4" /> Delete trip
            </ConfirmButton>
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="card !p-3">
      <div className={`text-xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
