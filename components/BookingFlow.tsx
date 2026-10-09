"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, CalendarDays, CircleAlert, Clock, MapPin, Ticket, X } from "lucide-react";
import { GenderIcon, SeatLegend, SeatMap, type SeatState } from "@/components/SeatMap";
import { DIRECTION_LABEL, formatDate, formatTime, normalizePhone, displayPhone } from "@/lib/format";
import { checkSeat, findSeat, seatStats, type Gender } from "@/lib/layout";
import type { BookingView, PublicTrip } from "@/lib/trips";

const POLL_MS = 10_000;
const PROFILE_KEY = "van:profile";
const bookingKey = (slug: string) => `van:booking:${slug}`;

type Profile = { name: string; phone: string; gender: Gender | null };

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: nothing to remember */
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json as T;
}

export function BookingFlow({ slug, initial }: { slug: string; initial: PublicTrip }) {
  const [trip, setTrip] = useState(initial);
  const [profile, setProfile] = useState<Profile>({ name: "", phone: "", gender: null });
  const [stopId, setStopId] = useState<number | null>(initial.stops.length === 1 ? initial.stops[0].id : null);
  const [seat, setSeat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [findOpen, setFindOpen] = useState(false);

  const toHome = trip.direction === "to_home";
  const stopWord = toHome ? "drop-off" : "pickup";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/t/${slug}`, { cache: "no-store" });
      if (res.ok) setTrip(await res.json());
    } catch {
      /* offline: keep the last map */
    }
  }, [slug]);

  // Remembered details, and this trip's booking if the passenger already has one.
  useEffect(() => {
    const p = load<Profile>(PROFILE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
    if (p) setProfile({ name: p.name ?? "", phone: p.phone ?? "", gender: p.gender ?? null });
    const mine = load<{ phone: string; code: string }>(bookingKey(slug));
    if (mine)
      post<{ booking: BookingView }>(`/api/t/${slug}/lookup`, mine)
        .then((r) => setBooking(r.booking))
        .catch(() => save(bookingKey(slug), null));
  }, [slug]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const gender = profile.gender;
  const stats = useMemo(() => seatStats(trip.layout, trip.taken), [trip]);

  // A seat picked earlier can become unavailable after a refresh (someone else took it or sat next to it).
  const seatValid = !!seat && !!gender && checkSeat(trip.layout, trip.taken, seat, gender).ok;
  const selected = seatValid ? seat : null;

  const seatState = (id: string): SeatState => {
    const taken = trip.taken[id];
    if (booking?.seatId === id) return { state: "selected", title: "Your seat" };
    if (taken) return { state: "taken", takenBy: taken, title: `Taken by a ${taken} passenger` };
    if (booking || trip.closed) return { state: "free" }; // view only: no onSelect
    if (!gender) return { state: "free", title: "Choose male or female first" };
    const check = checkSeat(trip.layout, trip.taken, id, gender);
    if (!check.ok) return { state: "blocked", title: check.reason };
    return { state: id === selected ? "selected" : "free" };
  };

  const updateProfile = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    save(PROFILE_KEY, next);
  };

  const selectedStop = trip.stops.find((s) => s.id === stopId) ?? null;
  const phoneOk = !!normalizePhone(profile.phone);
  const ready = !!gender && !!selectedStop && !!selected && profile.name.trim().length >= 2 && phoneOk;

  async function book() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ booking: BookingView }>(`/api/t/${slug}/book`, {
        name: profile.name,
        phone: profile.phone,
        gender,
        stopId,
        seatId: selected,
      });
      save(bookingKey(slug), { phone: r.booking.phone, code: r.booking.code });
      setBooking(r.booking);
      setSeat(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function cancel() {
    if (!booking || !confirm(`Cancel your booking for seat ${booking.seatLabel}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await post(`/api/t/${slug}/cancel`, { phone: booking.phone, code: booking.code });
      save(bookingKey(slug), null);
      setBooking(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-40 pt-5">
      <header className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand">
          <Bus className="size-4" /> {DIRECTION_LABEL[trip.direction]}
        </div>
        <h1 className="text-2xl font-bold leading-tight">{trip.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" /> {formatDate(trip.date, true)}
          </span>
          {trip.departTime && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> {toHome ? "Leaves university" : "Departs"} {formatTime(trip.departTime)}
            </span>
          )}
          <span>{trip.vehicleName}</span>
        </div>
        {trip.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{trip.notes}</p>}
      </header>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      {booking ? (
        <BookingTicket booking={booking} toHome={toHome} onCancel={trip.closed ? null : cancel} busy={busy} />
      ) : trip.closed ? (
        <div className="card mb-5 text-center">
          <p className="font-semibold">{trip.closed}</p>
          <p className="mt-1 text-sm text-slate-600">Contact the van admin if you still need a seat.</p>
        </div>
      ) : (
        <>
          <Step n={1} title="You are">
            <div className="grid grid-cols-2 gap-3">
              {(["female", "male"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => updateProfile({ gender: g })}
                  aria-pressed={gender === g}
                  className={[
                    "flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-semibold transition",
                    gender === g
                      ? g === "female"
                        ? "border-female bg-female-lt text-female"
                        : "border-male bg-male-lt text-male"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  ].join(" ")}
                >
                  <GenderIcon gender={g} className="size-5" />
                  {g === "female" ? "Female" : "Male"}
                  <span className="text-xs font-normal opacity-70">({stats.freeFor[g]} seats)</span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={2} title={`Your ${stopWord} point`}>
            <div className="space-y-2">
              {trip.stops.map((s) => (
                <label
                  key={s.id}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-white px-3 py-3 transition",
                    stopId === s.id ? "border-brand bg-brand-lt/40" : "border-slate-200 hover:border-slate-300",
                  ].join(" ")}
                >
                  <input type="radio" name="stop" className="accent-brand" checked={stopId === s.id} onChange={() => setStopId(s.id)} />
                  <MapPin className="size-4 shrink-0 text-slate-400" />
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className="text-sm font-semibold text-slate-700">{formatTime(s.time)}</span>
                </label>
              ))}
              {trip.stops.length === 0 && <p className="text-sm text-slate-500">The admin hasn&apos;t added any stops yet.</p>}
            </div>
            {selectedStop && (
              <p className="mt-2 text-sm text-slate-600">
                {toHome ? "Expected drop-off" : "Be at the stop by"} <b>{formatTime(selectedStop.time)}</b>.
              </p>
            )}
          </Step>
        </>
      )}

      <Step n={booking || trip.closed ? undefined : 3} title={booking ? "Seat map" : trip.closed ? "Seats" : "Pick your seat"}>
        {!booking && !trip.closed && !gender && <p className="mb-3 text-sm text-slate-500">Choose female or male above to see the seats you can take.</p>}
        <SeatMap layout={trip.layout} seatState={seatState} onSelect={booking || trip.closed || !gender ? undefined : setSeat} />
        <div className="mt-4">
          <SeatLegend items={["female", "male", "any", "selected", "takenF", "takenM", "blocked"]} />
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">
          {stats.free} of {stats.total} seats free. Males and females can&apos;t sit side by side. Seats across the aisle are fine.
        </p>
      </Step>

      {!booking && !trip.closed && (
        <Step n={4} title="Your details">
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input id="name" className="input" autoComplete="name" value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Phone (WhatsApp)
              </label>
              <input
                id="phone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0300 1234567"
                value={profile.phone}
                onChange={(e) => updateProfile({ phone: e.target.value })}
              />
              {profile.phone && !phoneOk && <p className="mt-1 text-xs text-red-600">Enter a valid phone number.</p>}
            </div>
          </div>
        </Step>
      )}

      {!booking && !trip.closed && (
        <p className="text-center text-sm">
          <button className="font-medium text-brand hover:underline" onClick={() => setFindOpen((v) => !v)}>
            Already booked? Find my booking
          </button>
        </p>
      )}
      {findOpen && !booking && (
        <FindBooking
          slug={slug}
          defaultPhone={profile.phone}
          onFound={(b) => {
            save(bookingKey(slug), { phone: b.phone, code: b.code });
            setBooking(b);
            setFindOpen(false);
          }}
        />
      )}

      {!booking && !trip.closed && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              {selected ? (
                <>
                  <div className="font-semibold">Seat {findSeat(trip.layout, selected)?.label}</div>
                  <div className="truncate text-slate-600">
                    {selectedStop ? `${selectedStop.name} · ${formatTime(selectedStop.time)}` : `Choose your ${stopWord} point`}
                  </div>
                </>
              ) : (
                <span className="text-slate-500">{!gender ? "Choose female or male" : !selectedStop ? `Choose your ${stopWord} point` : "Tap a seat"}</span>
              )}
            </div>
            <button className="btn-primary px-6 py-3" disabled={!ready || busy} onClick={book}>
              {busy ? "Booking…" : "Book seat"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Step({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {n && <span className="grid size-6 place-items-center rounded-full bg-brand text-xs text-white">{n}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

function BookingTicket({ booking, toHome, onCancel, busy }: { booking: BookingView; toHome: boolean; onCancel: (() => void) | null; busy: boolean }) {
  return (
    <section className="mb-4 overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-brand px-4 py-3 font-semibold text-white">
        <Ticket className="size-5" /> Your seat is booked
      </div>
      <dl className="grid grid-cols-2 gap-4 p-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Seat</dt>
          <dd className="text-3xl font-bold">{booking.seatLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Booking code</dt>
          <dd className="font-mono text-3xl font-bold tracking-widest">{booking.code}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">{toHome ? "Drop-off" : "Pickup"}</dt>
          <dd className="font-semibold">
            {booking.stop} · {formatTime(booking.time)}
          </dd>
        </div>
        <div className="col-span-2 text-sm text-slate-600">
          {booking.name} · {displayPhone(booking.phone)}
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-500">Keep your code to change or cancel later.</p>
        {onCancel && (
          <button className="btn-danger shrink-0" onClick={onCancel} disabled={busy}>
            Cancel booking
          </button>
        )}
      </div>
    </section>
  );
}

function FindBooking({ slug, defaultPhone, onFound }: { slug: string; defaultPhone: string; onFound: (b: BookingView) => void }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="card mt-3 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          onFound((await post<{ booking: BookingView }>(`/api/t/${slug}/lookup`, { phone, code })).booking);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <label className="label" htmlFor="find-phone">
            Phone
          </label>
          <input id="find-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="find-code">
            Code
          </label>
          <input
            id="find-code"
            className="input font-mono uppercase tracking-widest"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-ghost w-full" disabled={busy || !phone || code.length < 4}>
        Find booking
      </button>
    </form>
  );
}
