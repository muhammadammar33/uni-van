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
import { tripShareMessage } from "@/lib/share";
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
  const message = tripShareMessage(trip, stops, url);

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

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                toHome ? "bg-amber-100 text-amber-800" : "bg-brand-lt text-brand-dk"
              }`}
            >
              {DIRECTION_LABEL[trip.direction]}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${closed ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-800"}`}>
              {closed ? "● Closed" : "● Open for booking"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{trip.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="font-semibold text-slate-700">{formatDate(trip.date, true)}</span>
            {trip.departTime && <span>Departs {formatTime(trip.departTime)}</span>}
            <span>{trip.vehicleName}</span>
            {fares && <span>{fares.min === fares.max ? formatFare(fares.min) : `${formatFare(fares.min)}–${formatFare(fares.max)}`} per seat</span>}
            {trip.closesAt && <span>Booking stops {formatDate(trip.closesAt.slice(0, 10))} {formatTime(trip.closesAt.slice(11))}</span>}
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
            <ConfirmButton action={setTripStatus.bind(null, id, "open")} className="btn-primary">
              <LockOpen className="size-4" /> Reopen
            </ConfirmButton>
          )}
        </div>
      </div>
      {closed && trip.status === "open" && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{closed} Edit the date or closing time to reopen it.</p>}

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="card !p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seats booked</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">
            {bookings.length}
            <span className="text-lg text-slate-400">/{stats.total}</span>
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-female/70" style={{ width: `${(females / Math.max(stats.total, 1)) * 100}%` }} />
            <div className="bg-male/70" style={{ width: `${((bookings.length - females) / Math.max(stats.total, 1)) * 100}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              <b className="text-female">{females}</b> female · <b className="text-male">{bookings.length - females}</b> male
            </span>
            <span>
              free: <b className="text-female">{stats.freeFor.female}</b> F · <b className="text-male">{stats.freeFor.male}</b> M
            </span>
          </div>
        </div>
        <div className="card !p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fares collected</div>
          {hasFares ? (
            <>
              <div className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-700">
                {formatFare(collected)}
                <span className="text-lg text-slate-400"> / {expected.toLocaleString("en-US")}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500" style={{ width: `${(collected / Math.max(expected, 1)) * 100}%` }} />
              </div>
              <div className="mt-2 text-xs text-slate-500">{formatFare(expected - collected)} still to collect</div>
            </>
          ) : (
            <div className="mt-2 text-sm text-slate-500">
              No fare set. <Link href={`/admin/trips/${id}/edit`} className="font-semibold text-brand hover:underline">Add one</Link>
            </div>
          )}
        </div>
        <div className="card !p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{toHome ? "Dropped off" : "Boarded"}</div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">
            {rows.filter((r) => r.boarded).length}
            <span className="text-lg text-slate-400">/{rows.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand" style={{ width: `${(rows.filter((r) => r.boarded).length / Math.max(rows.length, 1)) * 100}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500">Ticked by the driver from their link</div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <ShareBox url={url} message={message} />
          <DriverLinkBox tripId={id} url={driverUrl} title={trip.title} />
        </div>

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
