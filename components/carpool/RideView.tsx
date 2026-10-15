"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Car, CircleAlert, CircleCheckBig, Clock, MessageCircle, MessageSquareWarning, Phone, Radio, Share2, Star, Users, X } from "lucide-react";
import { MapView, type MapMarker } from "@/components/carpool/MapView";
import { useIdVerify } from "@/components/carpool/IdVerify";
import { usePhoneVerify, VerifiedHint } from "@/components/carpool/PhoneVerify";
import { RateDriver } from "@/components/carpool/RateDriver";
import { RatingBadge, Stars, VerifiedBadge } from "@/components/carpool/Stars";
import { ShareTrip } from "@/components/carpool/ShareTrip";
import { BoardCheck } from "@/components/carpool/BoardCheck";
import { useMyLocation } from "@/components/carpool/useMyLocation";
import { GenderIcon } from "@/components/SeatMap";
import { displayPhone, formatDate, formatFare, formatTime, normalizePhone, todayLocal } from "@/lib/format";
import { distanceKm, formatKm, nearestIndex } from "@/lib/geo";
import type { Gender } from "@/lib/layout";
import type { BookingLookup, LivePosition, PublicRide, RideBookingView, RiderReview } from "@/lib/rides";
import { addDays, describeSchedule } from "@/lib/schedule";
import type { VerifyMode } from "@/lib/verify";

const PROFILE = "hamsafar:rider";
const bookingKey = (slug: string) => `hamsafar:booking:${slug}`;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json as T;
}

const dayWord = (d: string) => (d === todayLocal() ? "Today" : d === addDays(todayLocal(), 1) ? "Tomorrow" : formatDate(d));

export function RideView({ slug, initial, start, verify = null }: { slug: string; initial: PublicRide; start: { date?: string; p?: number; d?: number }; verify?: VerifyMode }) {
  const [ride, setRide] = useState(initial);
  const phoneCheck = usePhoneVerify(verify);
  const idCheck = useIdVerify();
  const loc = useMyLocation();
  const [driver, setDriver] = useState<LivePosition | null>(null);
  const open = ride.runs.filter((r) => r.left > 0);
  const [date, setDate] = useState(start.date && open.some((r) => r.date === start.date) ? start.date : (open[0]?.date ?? ""));
  const last = ride.points.length - 1;
  const [pickup, setPickup] = useState(Math.min(Math.max(0, start.p ?? 0), last - 1));
  const [drop, setDrop] = useState(Math.max(Math.min(last, start.d ?? last), 1));
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender | null>(ride.riders === "anyone" ? null : ride.riders);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<RideBookingView | null>(null);
  /** A booking whose ride is done: the rider can rate the driver. */
  const [past, setPast] = useState<{ booking: RideBookingView; review: RiderReview | null } | null>(null);
  const showFound = useCallback((r: BookingLookup) => {
    if (r.state === "upcoming") setBooking(r.booking);
    else setPast({ booking: r.booking, review: r.review });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([fetch(`/api/rides/${slug}`, { cache: "no-store" }), fetch(`/api/live?ride=${slug}`, { cache: "no-store" })]);
      if (r.ok) setRide(await r.json());
      if (l.ok) setDriver(((await l.json()).positions as LivePosition[]).find((p) => p.role === "driver") ?? null);
    } catch {}
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load of live data
    refresh();
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), 15000);
    return () => clearInterval(t);
  }, [refresh]);

  // Remembered rider details and this ride's booking.
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PROFILE) ?? "null");
      if (p) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
        setName(p.name ?? "");
        setPhone(p.phone ?? "");
        if (ride.riders === "anyone" && p.gender) setGender(p.gender);
      }
      const mine = JSON.parse(localStorage.getItem(bookingKey(slug)) ?? "null");
      if (mine)
        post<BookingLookup>(`/api/rides/${slug}/lookup`, mine)
          .then(showFound)
          .catch(() => localStorage.removeItem(bookingKey(slug)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on load
  }, [slug]);

  // With the visitor's location and no pickup chosen from search, suggest the closest stop.
  useEffect(() => {
    if (loc.pos && start.p === undefined) {
      const i = Math.min(nearestIndex(ride.points, loc.pos), last - 1);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- suggestion once location arrives
      setPickup(i);
      setDrop((d) => (d <= i ? last : d));
    }
  }, [loc.pos, ride.points, last, start.p]);

  const run = ride.runs.find((r) => r.date === date);
  const maxSeats = Math.min(run?.left ?? 0, 6);
  const phoneOk = !!normalizePhone(phone);
  const ready = !!run && run.left > 0 && drop > pickup && name.trim().length >= 2 && phoneOk && !!gender && ride.status === "active";

  const markers: MapMarker[] = useMemo(
    () => [
      ...(driver ? [{ lat: driver.lat, lng: driver.lng, kind: "driver" as const, label: driver.label ?? "Driver" }] : []),
      ...(loc.pos ? [{ ...loc.pos, kind: "me" as const }] : []),
    ],
    [driver, loc.pos],
  );

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setError(null);
    const phoneToken = await phoneCheck.ensure(phone);
    if (phoneToken === null) return setError("Verify your WhatsApp number to book.");
    setBusy(true);
    try {
      localStorage.setItem(PROFILE, JSON.stringify({ name, phone, gender }));
    } catch {}
    try {
      const body = { date, name, phone, gender, seats, pickupIdx: pickup, dropIdx: drop, phoneToken };
      const send = async () => {
        const res = await fetch(`/api/rides/${slug}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        return { res, json: await res.json().catch(() => ({})) };
      };
      let { res, json } = await send();
      // First booking (or ID turned down): the one-time ID check, then the booking goes through.
      if (res.status === 403 && (json.code === "id_required" || json.code === "id_rejected")) {
        const st = await idCheck.ensure("rider", { phone, phoneToken: phoneToken || undefined, name, gender }, json.idStatus);
        if (!st) throw new Error("Verify your ID once to book. It takes about a minute.");
        ({ res, json } = await send());
      }
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      const r = json as { booking: RideBookingView };
      try {
        localStorage.setItem(bookingKey(slug), JSON.stringify({ phone: r.booking.phone, code: r.booking.code }));
      } catch {}
      setBooking(r.booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function cancel() {
    if (!booking || !confirm("Cancel your seat on this ride?")) return;
    setBusy(true);
    try {
      await post(`/api/rides/${slug}/cancel`, { phone: booking.phone, code: booking.code });
      localStorage.removeItem(bookingKey(slug));
      setBooking(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const driverKm = driver && loc.pos ? distanceKm(driver, loc.pos) : null;

  return (
    <main className="relative mx-auto -mt-10 max-w-2xl space-y-4 px-4 pb-16">
      <section className="card !p-3">
        <MapView className="h-64 sm:h-80" routes={[{ points: ride.points, highlight: [pickup, drop] }]} markers={markers} fitKey="route" />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-slate-500">
          {driver ? (
            <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <Radio className="size-3.5" /> {driver.label} is sharing live location{driverKm !== null ? ` · ${formatKm(driverKm)} from you` : ""}
            </span>
          ) : (
            <span>The driver&apos;s live location appears here when they share it.</span>
          )}
          {loc.status !== "granted" && loc.status !== "unsupported" && (
            <button type="button" onClick={loc.request} className="font-semibold text-blue-700 hover:underline">
              Show where I am
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <ol className="relative">
          {ride.points.map((p, i) => {
            const mine = i === pickup || i === drop;
            const inside = i > pickup && i < drop;
            return (
              <li key={i} className="relative flex items-center gap-3 pb-3 pl-7 last:pb-0">
                {i < last && <span className={`absolute left-[9px] top-5 h-full w-0.5 ${i >= pickup && i < drop ? "bg-brand" : "bg-slate-200"}`} />}
                <span className={`absolute left-0 top-0.5 size-5 rounded-full border-2 ${mine ? "border-accent bg-accent" : inside ? "border-brand bg-brand" : "border-slate-300 bg-white"}`} />
                <span className={`flex-1 ${mine ? "font-bold" : "text-slate-600"}`}>{p.name}</span>
                {i === pickup && <span className="rounded-full bg-accent-lt px-2 py-0.5 text-xs font-bold text-amber-800">Your pickup</span>}
                {i === drop && <span className="rounded-full bg-accent-lt px-2 py-0.5 text-xs font-bold text-amber-800">Your drop-off</span>}
              </li>
            );
          })}
        </ol>
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">
            <X className="size-4" />
          </button>
        </div>
      )}

      {past && <RateDriver slug={slug} booking={past.booking} review={past.review} onSaved={(review) => { setPast({ ...past, review }); refresh(); }} />}

      {booking ? (
        <Ticket booking={booking} onCancel={cancel} onBoarded={setBooking} busy={busy} slug={slug} verified={ride.verified} />
      ) : ride.status !== "active" ? (
        <div className="card text-center font-semibold">{ride.status === "paused" ? "The driver has paused this ride for now." : "This ride was cancelled by the driver."}</div>
      ) : open.length === 0 ? (
        <div className="card text-center font-semibold">No seats left on the upcoming days.</div>
      ) : (
        <form onSubmit={book} className="card space-y-4">
          <h2 className="text-lg font-bold">Book a seat</h2>
          <div>
            <span className="label">Day</span>
            <div className="flex flex-wrap gap-2">
              {ride.runs.slice(0, 7).map((r) => (
                <button
                  key={r.date}
                  type="button"
                  disabled={r.left === 0}
                  onClick={() => setDate(r.date)}
                  aria-pressed={date === r.date}
                  className={`rounded-xl border-2 px-3 py-1.5 text-left text-sm disabled:opacity-40 ${date === r.date ? "border-brand bg-brand-lt/50" : "border-slate-200"}`}
                >
                  <span className="block font-bold">{dayWord(r.date)}</span>
                  <span className="block text-xs text-slate-500">{r.left === 0 ? "Full" : `${r.left} left`}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pickup">
                Get on at
              </label>
              <select id="pickup" className="input" value={pickup} onChange={(e) => { const i = Number(e.target.value); setPickup(i); if (drop <= i) setDrop(i + 1); }}>
                {ride.points.slice(0, -1).map((p, i) => (
                  <option key={i} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="drop">
                Get off at
              </label>
              <select id="drop" className="input" value={drop} onChange={(e) => setDrop(Number(e.target.value))}>
                {ride.points.map((p, i) =>
                  i > pickup ? (
                    <option key={i} value={i}>
                      {p.name}
                    </option>
                  ) : null,
                )}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="rname">
                Your name
              </label>
              <input id="rname" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div>
              <label className="label" htmlFor="rphone">
                Phone (WhatsApp)
              </label>
              <input id="rphone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phone && !phoneOk ? <p className="mt-1 text-xs text-red-600">Enter a valid phone number.</p> : <VerifiedHint mode={verify} phone={phone} />}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(["female", "male"] as const).map((g) => {
                const allowed = ride.riders === "anyone" || ride.riders === g;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={!allowed}
                    aria-pressed={gender === g}
                    onClick={() => setGender(g)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-semibold disabled:opacity-30 ${
                      gender === g ? (g === "female" ? "border-female bg-female-lt text-female" : "border-male bg-male-lt text-male") : "border-slate-200 text-slate-600"
                    }`}
                  >
                    <span aria-hidden><GenderIcon gender={g} className="size-4" /></span> {g === "female" ? "Female" : "Male"}
                  </button>
                );
              })}
            </div>
            <select aria-label="Seats" className="input !w-28" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
              {Array.from({ length: Math.max(1, maxSeats) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} seat{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full py-3.5 text-base" disabled={!ready || busy}>
            {busy ? "Booking…" : `Book ${seats > 1 ? `${seats} seats` : "my seat"}${ride.fare !== null ? ` · ${formatFare(ride.fare * seats)}` : ""}`}
          </button>
          <p className="text-center text-xs text-slate-500">
            By booking you agree to the{" "}
            <a href="/terms" target="_blank" className="underline">
              terms of use
            </a>
            .
          </p>
          <p className="text-center text-xs text-slate-500">You get the driver&apos;s number after booking. Your number is shown only to the driver.</p>
          {phoneCheck.dialog}
          {idCheck.dialog}
        </form>
      )}

      <section className="card space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <GenderIcon gender={ride.driverGender} className={`size-4 ${ride.driverGender === "female" ? "text-female" : "text-male"}`} />
          <b>{ride.driverName}</b> <span className="text-slate-500">is driving</span>
          {ride.verified && <VerifiedBadge />}
          <RatingBadge rating={ride.rating} className="ml-auto" />
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Car className="size-4" /> {ride.car}
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="size-4" /> Leaves {ride.points[0].name} at {formatTime(ride.departTime)} · {describeSchedule(ride.schedule)}
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Users className="size-4" /> {ride.seats} seats for riders{ride.riders !== "anyone" ? ` · ${ride.riders === "female" ? "women" : "men"} only` : ""}
        </div>
        {ride.notes && <p className="whitespace-pre-line rounded-xl bg-amber-50 p-3 text-amber-900">{ride.notes}</p>}
        <Reviews ride={ride} />
        {!past && !booking && <RateLookup slug={slug} driver={ride.driverName} onFound={showFound} />}
        <button
          type="button"
          className="btn-ghost mt-2 w-full"
          onClick={async () => {
            const text = `🚗 Carpool: ${ride.points[0].name} → ${ride.points[last].name}, ${formatTime(ride.departTime)} (${describeSchedule(ride.schedule)}). Book a seat: ${location.href.split("?")[0]}`;
            if (navigator.share) await navigator.share({ text }).catch(() => {});
            else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
          }}
        >
          <Share2 className="size-4" /> Share this ride
        </button>
      </section>
      <p className="text-center text-sm text-slate-500">
        <Link href={`/feedback?ride=${slug}&from=/r/${slug}`} className="inline-flex items-center gap-1.5 font-semibold hover:text-ink">
          <MessageSquareWarning className="size-4" /> Problem with this ride? Tell the Hamsafar team
        </Link>
      </p>
    </main>
  );
}

function Ticket({
  booking,
  onCancel,
  onBoarded,
  busy,
  slug,
  verified,
}: {
  booking: RideBookingView;
  onCancel: () => void;
  onBoarded: (b: RideBookingView) => void;
  busy: boolean;
  slug: string;
  verified: boolean;
}) {
  const msg = `Assalam o Alaikum ${booking.driverName.split(" ")[0]}, I booked ${booking.seats > 1 ? `${booking.seats} seats` : "a seat"} on your Hamsafar ride on ${formatDate(booking.date)}: ${booking.pickup} → ${booking.drop} at ${formatTime(booking.departTime)}. Name: ${booking.name}. Code ${booking.code}.`;
  return (
    <section className="animate-rise overflow-hidden rounded-3xl bg-white shadow-lift">
      <div className="bg-hero flex items-center gap-3 px-5 py-4 text-white">
        <CircleCheckBig className="size-10 shrink-0 animate-pop text-emerald-300" />
        <div>
          <div className="text-lg font-extrabold">You&apos;re booked!</div>
          <div className="text-sm text-teal-50/90">
            {dayWord(booking.date)} · {formatTime(booking.departTime)}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-4 p-5">
        <div className="col-span-2">
          <BoardCheck slug={slug} booking={booking} onBoarded={onBoarded} />
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your trip</dt>
          <dd className="font-bold">
            {booking.pickup} → {booking.drop}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Booking code</dt>
          <dd className="font-mono text-2xl font-bold tracking-[0.2em] text-brand">{booking.code}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Seats{booking.fare !== null ? " · fare" : ""}</dt>
          <dd className="font-bold">
            {booking.seats}
            {booking.fare !== null && ` · ${formatFare(booking.fare)}`}
          </dd>
        </div>
        <div className="col-span-2 rounded-2xl bg-slate-50 p-3">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Driver</dt>
          <dd className="font-bold">{booking.driverName}</dd>
          <dd className="text-sm text-slate-600">
            {booking.car}
            {booking.plate ? ` · ${booking.plate}` : ""} · {displayPhone(booking.driverPhone)}
          </dd>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`https://wa.me/${booking.driverPhone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="btn bg-[#25D366] text-white hover:bg-[#1ebe5b]">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
            <a href={`tel:+${booking.driverPhone}`} className="btn-ghost">
              <Phone className="size-4" /> Call
            </a>
          </div>
          <ShareTrip booking={booking} slug={slug} verified={verified} />
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-slate-500">Message the driver to confirm. Keep your code to cancel later.</p>
        <button className="btn-ghost shrink-0 !text-red-600" onClick={onCancel} disabled={busy}>
          Cancel seat
        </button>
      </div>
    </section>
  );
}

/** What riders said about this driver. */
function Reviews({ ride }: { ride: PublicRide }) {
  if (!ride.rating) return null;
  const said = (ride.reviews ?? []).filter((r) => r.comment);
  return (
    <div className="rounded-xl border border-slate-200/80 p-3">
      <div className="flex items-center gap-2">
        <Stars value={ride.rating.avg} />
        <b>{ride.rating.avg.toFixed(1)}</b>
        <span className="text-slate-500">
          from {ride.rating.count} rider{ride.rating.count === 1 ? "" : "s"}
        </span>
      </div>
      {said.length > 0 && (
        <ul className="mt-2 space-y-2">
          {said.slice(0, 4).map((r, i) => (
            <li key={i} className="text-slate-600">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Stars value={r.stars} className="size-3" /> {r.name} · {formatDate(r.date)}
              </span>
              <span className="[overflow-wrap:anywhere]">{r.comment}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rate a past ride from another phone or browser, with the phone number and booking code. */
function RateLookup({ slug, driver, onFound }: { slug: string; driver: string; onFound: (r: BookingLookup) => void }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 font-semibold text-brand hover:underline">
        <Star className="size-4" /> Travelled with {driver}? Rate the ride
      </button>
    );
  return (
    <form
      className="space-y-2 rounded-xl bg-slate-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await post<BookingLookup>(`/api/rides/${slug}/lookup`, { phone, code });
          if (r.state === "upcoming") setError("That ride hasn't happened yet. You can rate it an hour after it leaves.");
          else {
            try {
              localStorage.setItem(bookingKey(slug), JSON.stringify({ phone: r.booking.phone, code: r.booking.code }));
            } catch {}
            onFound(r);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-semibold">Enter the phone number and code from your booking</p>
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <input className="input" type="tel" inputMode="tel" placeholder="0300 1234567" aria-label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input uppercase" placeholder="Code" aria-label="Booking code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || !phone || code.length < 4}>
        {busy ? "Finding your ride…" : "Rate my ride"}
      </button>
    </form>
  );
}
