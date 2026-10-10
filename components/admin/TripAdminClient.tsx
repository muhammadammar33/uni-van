"use client";

import { useActionState, useState, useTransition } from "react";
import { keepFields } from "@/lib/keepFields";
import { Armchair, Banknote, MessageCircle, Users, Phone, RefreshCw, Send, Trash2, UserCheck, X } from "lucide-react";
import { adminBook, duplicateTrip, removeBooking, resetDriverLink, setBookingFlag, type FormState } from "@/app/admin/actions";
import { CopyButton } from "@/components/admin/CopyButton";
import { GenderIcon, SeatLegend, SeatMap, type SeatState } from "@/components/SeatMap";
import { displayPhone, formatFare, formatTime } from "@/lib/format";
import { checkSeat, findSeat, GENDERS, type Gender, type Layout, type Taken } from "@/lib/layout";

export type AdminBookRules = { genderRule: "separate" | "none"; membersOnly: boolean; rider: string };

export type AdminBooking = {
  id: number;
  seatId: string;
  seatLabel: string;
  name: string;
  phone: string;
  gender: Gender | null;
  stopId: number;
  fare: number | null;
  boarded: boolean;
  paid: boolean;
};
type Stop = { id: number; name: string; time: string };

export function ShareBox({ url, message }: { url: string; message: string }) {
  return (
    <section className="card flex min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-[#25D366]/15 text-[#128C7E]">
          <Users className="size-5" />
        </span>
        <div>
          <h2 className="font-bold">Students&apos; link</h2>
          <p className="text-sm text-slate-500">Share in the WhatsApp group</p>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 pl-3 text-sm ring-1 ring-slate-200/70">
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand hover:underline">
          {url.replace(/^https?:\/\//, "")}
        </a>
        <CopyButton text={url} label="Copy" className="btn-ghost !px-3 !py-1.5" />
      </div>
      <details className="group mb-3 text-sm">
        <summary className="cursor-pointer list-none font-medium text-slate-500 hover:text-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Preview message ▾</span>
          <span className="hidden group-open:inline">Hide message ▴</span>
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-[#efeae2] p-3 font-sans text-[13px] text-slate-800">{message}</pre>
      </details>
      <div className="mt-auto flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn flex-1 bg-[#25D366] text-white shadow-sm shadow-[#25D366]/30 hover:bg-[#1ebe5b]">
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
  rules,
}: {
  tripId: number;
  layout: Layout;
  bookings: AdminBooking[];
  stops: Stop[];
  toHome: boolean;
  rules: AdminBookRules;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const bySeat = new Map(bookings.map((b) => [b.seatId, b]));
  const taken: Taken = Object.fromEntries(bookings.map((b) => [b.seatId, b.gender]));

  const seatState = (id: string): SeatState => {
    const b = bySeat.get(id);
    if (b) return { state: id === selected ? "selected" : "taken", takenBy: b.gender ?? undefined, caption: b.name.split(" ")[0], title: `${b.name} · ${displayPhone(b.phone)}` };
    const fits = GENDERS.filter((g) => checkSeat(layout, taken, id, g, rules.genderRule).ok);
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
          <SeatMap layout={layout} seatState={seatState} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} selectTaken neutral={rules.genderRule === "none"} />
          <div className="mt-4">
            <SeatLegend items={["female", "male", "any", "takenF", "takenM"]} />
          </div>
        </div>
        <div>
          {!seat ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              <Armchair className="size-8 text-slate-300" />
              <p>
                <b className="text-slate-700">Tap a seat.</b> A booked seat shows the passenger, with call, WhatsApp and Paid ticks. A free seat lets you book it for someone who called you.
              </p>
            </div>
          ) : booking ? (
            <PassengerCard tripId={tripId} booking={booking} stop={stops.find((s) => s.id === booking.stopId)} toHome={toHome} onClose={() => setSelected(null)} />
          ) : (
            <AdminBookForm
              key={seat.id}
              tripId={tripId}
              seatId={seat.id}
              seatLabel={seat.label}
              allowed={GENDERS.filter((g) => checkSeat(layout, taken, seat.id, g, rules.genderRule).ok)}
              rules={rules}
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
            {booking.gender && <GenderIcon gender={booking.gender} className={`size-4 ${booking.gender === "female" ? "text-female" : "text-male"}`} />}
            {booking.name}
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-600">
        {toHome ? "Drop-off" : "Pickup"}: {stop ? `${stop.name} · ${formatTime(stop.time)}` : "?"}
        {booking.fare !== null && ` · ${formatFare(booking.fare)}`}
      </p>
      <div className="mb-3 flex gap-2">
        <FlagToggle tripId={tripId} booking={booking} field="boarded" label={toHome ? "Dropped" : "Boarded"} />
        <FlagToggle tripId={tripId} booking={booking} field="paid" label="Paid" />
      </div>
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
  rules,
}: {
  tripId: number;
  seatId: string;
  seatLabel: string;
  allowed: Gender[];
  stops: Stop[];
  onDone: () => void;
  rules: AdminBookRules;
}) {
  const [state, action, pending] = useActionState(async (_: FormState, form: FormData) => {
    const res = await adminBook(tripId, { ...Object.fromEntries(form), seatId });
    if (res?.ok) onDone();
    return res;
  }, undefined);
  if (!allowed.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Seat {seatLabel} can&apos;t be used: it sits between a male and a female passenger.</p>;
  return (
    <form onSubmit={keepFields(action)} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Book seat {seatLabel} for someone</h3>
      {rules.membersOnly ? (
        <p className="text-xs text-slate-500">Registered {rules.rider}s only: enter their phone number and their name and gender come from the list.</p>
      ) : (
        <input name="name" required placeholder="Name" className="input" />
      )}
      <input name="phone" required type="tel" placeholder="Phone, e.g. 0300 1234567" className="input" />
      <div className={`grid gap-2 ${rules.membersOnly || rules.genderRule === "none" ? "" : "grid-cols-2"}`}>
        {!rules.membersOnly && rules.genderRule === "separate" && (
          <select name="gender" className="input" defaultValue={allowed[0]}>
            {allowed.map((g) => (
              <option key={g} value={g}>
                {g === "female" ? "Female" : "Male"}
              </option>
            ))}
          </select>
        )}
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
    <form onSubmit={keepFields(action)} className="card space-y-3">
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

/** Boarded / paid tick, also settable by the driver from their page. */
export function FlagToggle({ tripId, booking, field, label }: { tripId: number; booking: AdminBooking; field: "boarded" | "paid"; label: string }) {
  const [pending, start] = useTransition();
  const on = booking[field];
  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      title={on ? `Marked ${label.toLowerCase()}` : `Mark ${label.toLowerCase()}`}
      onClick={() => start(() => setBookingFlag(tripId, booking.id, field, !on))}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
        on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 text-slate-400 hover:border-slate-300"
      } ${pending ? "opacity-60" : ""}`}
    >
      {field === "paid" ? <Banknote className="size-3" /> : <UserCheck className="size-3" />}
      {label}
    </button>
  );
}

export function DriverLinkBox({ tripId, url, title }: { tripId: number; url: string; title: string }) {
  const [pending, start] = useTransition();
  const message = `🚐 Passenger list for *${title}*\nOpen it on the day, mark who boarded and who paid:\n${url}`;
  return (
    <section className="card flex min-w-0 flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white">
          <UserCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-bold">Driver&apos;s link</h2>
          <p className="text-sm text-slate-500">Private: send to the driver only</p>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 pl-3 text-sm ring-1 ring-slate-200/70">
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand hover:underline">
          {url.replace(/^https?:\/\//, "")}
        </a>
        <CopyButton text={url} label="Copy" className="btn-ghost !px-3 !py-1.5" />
      </div>
      <p className="mb-3 text-sm text-slate-500">
        No login. Passengers stop by stop with names and numbers, and Boarded / Paid ticks you see here live.
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="btn flex-1 bg-slate-900 text-white hover:bg-slate-800">
          <Send className="size-4" /> Send to driver
        </a>
        <button
          type="button"
          className="btn-ghost"
          disabled={pending}
          title="The current link stops working"
          onClick={() => confirm("Make a new driver link? The current one stops working.") && start(() => resetDriverLink(tripId))}
        >
          <RefreshCw className="size-4" /> New link
        </button>
      </div>
    </section>
  );
}
