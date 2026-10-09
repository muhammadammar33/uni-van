"use client";

import { useActionState, useState, useTransition } from "react";
import { MessageCircle, Phone, Send, Trash2, X } from "lucide-react";
import { adminBook, duplicateTrip, removeBooking, type FormState } from "@/app/admin/actions";
import { CopyButton } from "@/components/admin/CopyButton";
import { GenderIcon, SeatLegend, SeatMap, type SeatState } from "@/components/SeatMap";
import { displayPhone, formatTime } from "@/lib/format";
import { checkSeat, findSeat, GENDERS, type Gender, type Layout, type Taken } from "@/lib/layout";

export type AdminBooking = { id: number; seatId: string; seatLabel: string; name: string; phone: string; gender: Gender; stopId: number };
type Stop = { id: number; name: string; time: string };

export function ShareBox({ url, message }: { url: string; message: string }) {
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Share in the WhatsApp group</h2>
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2 pl-3 text-sm">
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand hover:underline">
          {url}
        </a>
        <CopyButton text={url} label="Copy link" />
      </div>
      <pre className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 p-3 font-sans text-sm text-slate-700">{message}</pre>
      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <Send className="size-4" /> Share on WhatsApp
        </a>
        <CopyButton text={message} label="Copy message" />
      </div>
    </section>
  );
}

export function AdminSeatPanel({
  tripId,
  layout,
  bookings,
  stops,
  toHome,
}: {
  tripId: number;
  layout: Layout;
  bookings: AdminBooking[];
  stops: Stop[];
  toHome: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const bySeat = new Map(bookings.map((b) => [b.seatId, b]));
  const taken: Taken = Object.fromEntries(bookings.map((b) => [b.seatId, b.gender]));

  const seatState = (id: string): SeatState => {
    const b = bySeat.get(id);
    if (b) return { state: id === selected ? "selected" : "taken", takenBy: b.gender, caption: b.name.split(" ")[0], title: `${b.name} · ${displayPhone(b.phone)}` };
    const fits = GENDERS.filter((g) => checkSeat(layout, taken, id, g).ok);
    if (!fits.length) return { state: id === selected ? "selected" : "blocked", title: "No one can sit here: opposite genders on both sides" };
    return { state: id === selected ? "selected" : "free" };
  };

  const booking = selected ? bySeat.get(selected) : undefined;
  const seat = selected ? findSeat(layout, selected) : undefined;

  return (
    <section className="card">
      <h2 className="mb-1 font-semibold">Seats</h2>
      <p className="mb-4 text-sm text-slate-500">Tap a booked seat to see the passenger, or a free seat to book it for someone.</p>
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div>
          <SeatMap layout={layout} seatState={seatState} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} selectTaken />
          <div className="mt-4">
            <SeatLegend items={["female", "male", "any", "takenF", "takenM"]} />
          </div>
        </div>
        <div>
          {!seat ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No seat selected</p>
          ) : booking ? (
            <PassengerCard tripId={tripId} booking={booking} stop={stops.find((s) => s.id === booking.stopId)} toHome={toHome} onClose={() => setSelected(null)} />
          ) : (
            <AdminBookForm
              key={seat.id}
              tripId={tripId}
              seatId={seat.id}
              seatLabel={seat.label}
              allowed={GENDERS.filter((g) => checkSeat(layout, taken, seat.id, g).ok)}
              stops={stops}
              onDone={() => setSelected(null)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function waLink(phone: string) {
  return `https://wa.me/${phone}`;
}

function PassengerCard({ tripId, booking, stop, toHome, onClose }: { tripId: number; booking: AdminBooking; stop?: Stop; toHome: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Seat {booking.seatLabel}</div>
          <div className="flex items-center gap-1.5 text-lg font-semibold">
            <GenderIcon gender={booking.gender} className={`size-4 ${booking.gender === "female" ? "text-female" : "text-male"}`} />
            {booking.name}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-600">
        {toHome ? "Drop-off" : "Pickup"}: {stop ? `${stop.name} · ${formatTime(stop.time)}` : "?"}
      </p>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:+${booking.phone}`} className="btn-ghost">
          <Phone className="size-4" /> {displayPhone(booking.phone)}
        </a>
        <a href={waLink(booking.phone)} target="_blank" rel="noreferrer" className="btn-ghost">
          <MessageCircle className="size-4" /> WhatsApp
        </a>
        <button
          className="btn-danger"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Remove ${booking.name} from seat ${booking.seatLabel}?`)) return;
            start(async () => {
              await removeBooking(tripId, booking.id);
              onClose();
            });
          }}
        >
          <Trash2 className="size-4" /> Remove
        </button>
      </div>
    </div>
  );
}

function AdminBookForm({
  tripId,
  seatId,
  seatLabel,
  allowed,
  stops,
  onDone,
}: {
  tripId: number;
  seatId: string;
  seatLabel: string;
  allowed: Gender[];
  stops: Stop[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(async (_: FormState, form: FormData) => {
    const res = await adminBook(tripId, { ...Object.fromEntries(form), seatId });
    if (res?.ok) onDone();
    return res;
  }, undefined);
  if (!allowed.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Seat {seatLabel} can&apos;t be used: it sits between a male and a female passenger.</p>;
  return (
    <form action={action} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Book seat {seatLabel} for someone</h3>
      <input name="name" required placeholder="Name" className="input" />
      <input name="phone" required type="tel" placeholder="Phone, e.g. 0300 1234567" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <select name="gender" className="input" defaultValue={allowed[0]}>
          {allowed.map((g) => (
            <option key={g} value={g}>
              {g === "female" ? "Female" : "Male"}
            </option>
          ))}
        </select>
        <select name="stopId" className="input" required defaultValue="">
          <option value="" disabled>
            Stop…
          </option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {formatTime(s.time)}
            </option>
          ))}
        </select>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>
        Book seat {seatLabel}
      </button>
    </form>
  );
}

export function RemoveBookingButton({ tripId, bookingId, name }: { tripId: number; bookingId: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="p-1.5 text-slate-400 hover:text-red-600"
      disabled={pending}
      aria-label={`Remove ${name}`}
      onClick={() => confirm(`Remove ${name}?`) && start(() => removeBooking(tripId, bookingId))}
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function DuplicateForm({ tripId, nextDate, returnLabel }: { tripId: number; nextDate: string; returnLabel: string }) {
  const [state, action, pending] = useActionState(duplicateTrip.bind(null, tripId), undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Copy this trip</h2>
      <p className="text-sm text-slate-500">Same stops, seating and note, on another date. Passengers are not copied.</p>
      <input name="date" type="date" required defaultValue={nextDate} className="input" aria-label="Date of the copy" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="reverse" className="size-4 accent-brand" />
        Make it the return trip ({returnLabel}, stops reversed)
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn-ghost w-full" disabled={pending}>
        {pending ? "Copying…" : "Copy trip"}
      </button>
    </form>
  );
}
