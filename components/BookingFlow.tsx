"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, CalendarDays, Check, CircleAlert, CircleCheckBig, Clock, MapPin, Share2, X } from "lucide-react";
import { GenderIcon, SeatLegend, SeatMap, type SeatState } from "@/components/SeatMap";
import { formatDate, formatDateRange, formatFare, formatTime, normalizePhone, displayPhone } from "@/lib/format";
import { orgInfo } from "@/lib/orgTypes";
import { checkSeat, fareRange, findSeat, seatFare, seatStats, type Gender } from "@/lib/layout";
import type { BookingView, PublicTrip } from "@/lib/trips";

const POLL_MS = 10_000;
const PROFILE_KEY = "van:profile";
const bookingKey = (slug: string) => `van:booking:${slug}`;

type Profile = { name: string; phone: string; gender: Gender | null; refNo: string };
type Member = { name: string; gender: Gender };

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
  const [profile, setProfile] = useState<Profile>({ name: "", phone: "", gender: null, refNo: "" });
  const [stopId, setStopId] = useState<number | null>(initial.stops.length === 1 ? initial.stops[0].id : null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  /** Members-only trips: the registered rider found for the phone (+ roll no.) entered. */
  const [member, setMember] = useState<Member | null>(null);

  const info = orgInfo(trip.org.type);
  const toHome = trip.direction === "to_home";
  const stopWord = toHome ? "drop-off" : "pickup";
  const rule = trip.genderRule;
  const multi = trip.maxSeats > 1;

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
    if (p) setProfile({ name: p.name ?? "", phone: p.phone ?? "", gender: p.gender ?? null, refNo: p.refNo ?? "" });
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

  // Whose gender the seat rules use: the registered rider's, nobody's (no rule), or the one chosen.
  const gender: Gender | null = trip.membersOnly ? (member?.gender ?? null) : rule === "none" ? null : profile.gender;
  const canPick = trip.membersOnly ? !!member : rule === "none" || !!gender;

  const stats = useMemo(() => seatStats(trip.layout, trip.taken, rule), [trip, rule]);
  const fares = useMemo(() => fareRange(trip.layout, trip.fare), [trip]);
  // Seats only show their price when prices differ.
  const faresVary = !!fares && fares.min !== fares.max;
  const priceCaption = (id: string) => {
    const f = faresVary ? seatFare(trip.layout, id, trip.fare) : null;
    return f === null ? undefined : `Rs${f}`;
  };

  // Seats picked earlier can become unavailable after a refresh (someone else took them or sat next to them).
  const selected = useMemo(() => {
    if (!canPick) return [];
    const taken = { ...trip.taken };
    const ok: string[] = [];
    for (const id of picked) {
      if (checkSeat(trip.layout, taken, id, gender, rule).ok) {
        ok.push(id);
        taken[id] = gender;
      }
    }
    return ok;
  }, [picked, trip, gender, rule, canPick]);

  const seatState = (id: string): SeatState => {
    if (booking?.seats.some((x) => x.id === id)) return { state: "selected", title: "Your seat" };
    if (id in trip.taken) {
      const by = trip.taken[id];
      return { state: "taken", takenBy: by ?? undefined, title: by ? `Taken by a ${by} passenger` : "Taken" };
    }
    if (booking || trip.closed) return { state: "free" }; // view only: no onSelect
    if (!canPick) return { state: "free", title: trip.membersOnly ? "Confirm who you are first" : "Choose male or female first" };
    if (selected.includes(id)) return { state: "selected", caption: priceCaption(id) };
    const check = checkSeat(trip.layout, { ...trip.taken, ...Object.fromEntries(selected.map((x) => [x, gender])) }, id, gender, rule);
    if (!check.ok) return { state: "blocked", title: check.reason };
    return { state: "free", caption: priceCaption(id) };
  };

  const toggleSeat = (id: string) => {
    setError(null);
    setPicked(() => {
      if (selected.includes(id)) return selected.filter((x) => x !== id);
      if (!multi) return [id];
      if (selected.length >= trip.maxSeats) {
        setError(`You can book up to ${trip.maxSeats} seats at once.`);
        return selected;
      }
      return [...selected, id];
    });
  };

  const updateProfile = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    save(PROFILE_KEY, next);
  };

  const selectedStop = trip.stops.find((s) => s.id === stopId) ?? null;
  const phoneOk = !!normalizePhone(profile.phone);
  const detailsOk = trip.membersOnly ? !!member : profile.name.trim().length >= 2 && phoneOk;
  const ready = canPick && !!selectedStop && selected.length > 0 && detailsOk;
  const total = selected.reduce((sum, id) => sum + (seatFare(trip.layout, id, trip.fare) ?? 0), 0);
  const seatLabels = selected
    .map((id) => findSeat(trip.layout, id)?.label ?? id)
    .sort((a, b) => Number(a) - Number(b))
    .join(", ");

  async function identify() {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ rider: Member }>(`/api/t/${slug}/identify`, { phone: profile.phone, refNo: profile.refNo });
      setMember(r.rider);
    } catch (e) {
      setMember(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function book() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ booking: BookingView }>(`/api/t/${slug}/book`, {
        name: trip.membersOnly ? undefined : profile.name,
        phone: profile.phone,
        refNo: trip.membersOnly ? profile.refNo : undefined,
        gender,
        stopId,
        seatIds: selected,
      });
      save(bookingKey(slug), { phone: r.booking.phone, code: r.booking.code });
      setBooking(r.booking);
      setPicked([]);
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

  // Step numbers depend on which steps this trip has.
  const steps = [trip.membersOnly ? "who" : rule === "separate" ? "gender" : null, "stop", "seat", trip.membersOnly ? null : "details"].filter(Boolean) as string[];
  const stepNo = (key: string) => steps.indexOf(key) + 1;
  const stepDone = { who: !!member, gender: !!gender, stop: !!selectedStop, seat: selected.length > 0, details: detailsOk };
  const legend: Parameters<typeof SeatLegend>[0]["items"] =
    rule === "none" ? ["selected", "takenAny"] : booking || trip.closed ? ["female", "male", "any", "selected", "takenF", "takenM"] : ["female", "male", "any", "selected", "takenF", "takenM", "blocked"];

  return (
    <div className="min-h-dvh pb-40">
      <header className="bg-hero relative overflow-hidden px-4 pb-14 pt-6 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative mx-auto max-w-lg animate-rise">
          <div className="flex items-center justify-between gap-3">
            <a href={`/o/${trip.org.slug}`} className="min-w-0 truncate text-sm font-bold text-accent hover:underline">
              {info.emoji} {trip.org.name}
            </a>
            {!trip.closed && (
              <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-teal-100">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
                </span>
                {stats.free} seats left
              </span>
            )}
          </div>
          <h1 className="mt-2 text-[1.7rem] font-extrabold leading-tight tracking-tight">{trip.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-teal-50/90">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" /> {formatDateRange(trip.date, trip.endDate, true)}
            </span>
            {trip.departTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" /> Departs {formatTime(trip.departTime)}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {fares && (
              <span className="rounded-full bg-accent px-3 py-1 font-bold text-ink">
                {fares.min === fares.max ? `${formatFare(fares.min)} per seat` : `${formatFare(fares.min)} – ${formatFare(fares.max)}`}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-medium ring-1 ring-white/20">
              <Bus className="size-3.5" /> {info.direction[trip.direction]}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 font-medium ring-1 ring-white/20">{trip.vehicleName}</span>
          </div>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 max-w-lg px-4">
        {trip.notes && (
          <p className="mb-4 flex gap-2 whitespace-pre-line rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 shadow-soft">
            <span aria-hidden>📢</span>
            {trip.notes}
          </p>
        )}

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
          <BookingTicket booking={booking} trip={trip} onCancel={trip.closed ? null : cancel} busy={busy} />
        ) : trip.closed ? (
          <div className="card mb-5 text-center">
            <p className="font-semibold">{trip.closed}</p>
            <p className="mt-1 text-sm text-slate-600">
              Contact {trip.org.name}
              {trip.org.phone ? ` on ${displayPhone(trip.org.phone)}` : ""} if you still need a seat.
            </p>
          </div>
        ) : (
          <>
            {trip.membersOnly && (
              <Step n={stepNo("who")} done={stepDone.who} title={`Registered ${info.rider}`}>
                {member ? (
                  <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3">
                    <GenderIcon gender={member.gender} className={`size-5 ${member.gender === "female" ? "text-female" : "text-male"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{member.name}</div>
                      <div className="text-xs text-slate-600">{displayPhone(normalizePhone(profile.phone) ?? profile.phone)}</div>
                    </div>
                    <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={() => setMember(null)}>
                      Not you?
                    </button>
                  </div>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      identify();
                    }}
                  >
                    <p className="text-sm text-slate-600">
                      This trip is for {trip.org.name}&apos;s registered {info.riders}. Enter the phone number on your record.
                    </p>
                    <div className="grid grid-cols-[1fr_8rem] gap-2">
                      <input
                        className="input"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="0300 1234567"
                        aria-label="Phone"
                        value={profile.phone}
                        onChange={(e) => updateProfile({ phone: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder={info.refLabel}
                        aria-label={info.refLabel}
                        value={profile.refNo}
                        onChange={(e) => updateProfile({ refNo: e.target.value })}
                      />
                    </div>
                    <p className="text-xs text-slate-500">Your {info.refLabel.toLowerCase()} is needed only if your office added one to your record.</p>
                    <button className="btn-primary w-full" disabled={busy || !phoneOk}>
                      {busy ? "Checking…" : "Continue"}
                    </button>
                  </form>
                )}
              </Step>
            )}

            {!trip.membersOnly && rule === "separate" && (
              <Step n={stepNo("gender")} done={stepDone.gender} title="You are">
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
            )}

            <Step n={stepNo("stop")} done={stepDone.stop} title={`Your ${stopWord} point`}>
              <ol className="relative">
                {trip.stops.map((s, i) => {
                  const on = stopId === s.id;
                  return (
                    <li key={s.id} className="relative pb-2 pl-7 last:pb-0">
                      {i < trip.stops.length - 1 && <span className="absolute left-[9px] top-6 h-full w-0.5 bg-slate-200" aria-hidden />}
                      <span
                        className={`absolute left-0 top-3.5 grid size-5 place-items-center rounded-full border-2 transition ${
                          on ? "border-brand bg-brand" : "border-slate-300 bg-white"
                        }`}
                        aria-hidden
                      >
                        {on && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition ${
                          on ? "border-brand bg-brand-lt/40 shadow-sm" : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <input type="radio" name="stop" className="sr-only" checked={on} onChange={() => setStopId(s.id)} />
                        <span className="flex-1 font-semibold">{s.name}</span>
                        <span className={`rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${on ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}>
                          {formatTime(s.time)}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {trip.stops.length === 0 && <p className="text-sm text-slate-500">The admin hasn&apos;t added any stops yet.</p>}
              </ol>
              {selectedStop && (
                <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <Clock className="size-4 text-brand" />
                  {toHome ? "Expected drop-off at" : "Be at the stop by"} <b className="text-ink">{formatTime(selectedStop.time)}</b>
                </p>
              )}
            </Step>
          </>
        )}

        <Step
          n={booking || trip.closed ? undefined : stepNo("seat")}
          done={stepDone.seat}
          title={booking ? "Seat map" : trip.closed ? "Seats" : multi ? `Pick your seats (up to ${trip.maxSeats})` : "Pick your seat"}
        >
          {!booking && !trip.closed && !canPick && (
            <p className="mb-3 text-sm text-slate-500">
              {trip.membersOnly ? "Confirm who you are above to see the seats you can take." : "Choose female or male above to see the seats you can take."}
            </p>
          )}
          <SeatMap layout={trip.layout} seatState={seatState} onSelect={booking || trip.closed || !canPick ? undefined : toggleSeat} neutral={rule === "none"} />
          <div className="mt-4">
            <SeatLegend items={legend} />
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            {stats.free} of {stats.total} seats free.{" "}
            {rule === "separate" ? "Males and females can't sit side by side. Seats across the aisle are fine." : multi ? "Tap several seats to book for your family or group." : ""}
          </p>
        </Step>

        {!booking && !trip.closed && !trip.membersOnly && (
          <Step n={stepNo("details")} done={stepDone.details} title={multi ? "Who's booking" : "Your details"}>
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
                {selected.length ? (
                  <>
                    <div className="truncate font-semibold">
                      {selected.length > 1 ? "Seats" : "Seat"} {seatLabels}
                      {fares && total > 0 && ` · ${formatFare(total)}`}
                    </div>
                    <div className="truncate text-slate-600">
                      {selectedStop ? `${selectedStop.name} · ${formatTime(selectedStop.time)}` : `Choose your ${stopWord} point`}
                    </div>
                  </>
                ) : (
                  <span className="text-slate-500">
                    {!canPick ? (trip.membersOnly ? "Confirm who you are" : "Choose female or male") : !selectedStop ? `Choose your ${stopWord} point` : multi ? "Tap your seats" : "Tap a seat"}
                  </span>
                )}
              </div>
              <button className="btn-primary px-6 py-3" disabled={!ready || busy} onClick={book}>
                {busy ? "Booking…" : selected.length > 1 ? `Book ${selected.length} seats` : "Book seat"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Step({ n, done, title, children }: { n?: number; done?: boolean; title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 animate-rise">
      <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold">
        {n &&
          (done ? (
            <span className="grid size-7 animate-pop place-items-center rounded-full bg-emerald-500 text-white">
              <Check className="size-4" strokeWidth={3} />
            </span>
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-brand-lt text-xs font-extrabold text-brand-dk">{n}</span>
          ))}
        {title}
      </h2>
      {children}
    </section>
  );
}

function BookingTicket({
  booking,
  trip,
  onCancel,
  busy,
}: {
  booking: BookingView;
  trip: PublicTrip;
  onCancel: (() => void) | null;
  busy: boolean;
}) {
  const toHome = trip.direction === "to_home";
  const shareText = `🚐 I booked seat${booking.seats.length > 1 ? "s" : ""} ${booking.seatLabel} on "${trip.title}" (${formatDate(trip.date)}). ${toHome ? "Drop-off" : "Pickup"}: ${booking.stop}, ${formatTime(booking.time)}. Booking code ${booking.code}.`;
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        /* closed the share sheet */
        return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };
  return (
    <section className="mb-4 animate-rise">
      <div className="relative overflow-hidden rounded-3xl bg-white shadow-lift">
        <div className="bg-hero px-5 pb-5 pt-4 text-white">
          <div className="flex items-center gap-3">
            <CircleCheckBig className="size-10 shrink-0 animate-pop text-emerald-300" />
            <div>
              <div className="text-lg font-extrabold">You&apos;re booked!</div>
              <div className="text-sm text-teal-50/90">
                {formatDateRange(trip.date, trip.endDate)} · {orgInfo(trip.org.type).direction[trip.direction]}
              </div>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 px-5 py-5">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{booking.seats.length > 1 ? "Seats" : "Seat"}</dt>
            <dd className={`font-extrabold leading-none ${booking.seats.length > 2 ? "text-2xl" : "text-4xl"}`}>{booking.seatLabel}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Booking code</dt>
            <dd className="font-mono text-3xl font-bold tracking-[0.2em] text-brand">{booking.code}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{toHome ? "Drop-off" : "Pickup"}</dt>
            <dd className="flex items-center gap-1.5 font-bold">
              <MapPin className="size-4 text-brand" /> {booking.stop} · {formatTime(booking.time)}
            </dd>
          </div>
          {booking.fare !== null && (
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fare</dt>
              <dd className="font-bold">{formatFare(booking.fare)}</dd>
            </div>
          )}
          <div className={booking.fare !== null ? "" : "col-span-2"}>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Passenger</dt>
            <dd className="truncate font-semibold">{booking.name}</dd>
            <dd className="text-sm text-slate-500">{displayPhone(booking.phone)}</dd>
          </div>
        </dl>
        {/* Perforation */}
        <div className="relative flex items-center" aria-hidden>
          <span className="absolute -left-3 size-6 rounded-full bg-mist" />
          <span className="mx-5 w-full border-t-2 border-dashed border-slate-200" />
          <span className="absolute -right-3 size-6 rounded-full bg-mist" />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <button className="btn-primary flex-1" onClick={share}>
            <Share2 className="size-4" /> Share
          </button>
          {onCancel && (
            <button className="btn-ghost flex-1 !text-red-600" onClick={onCancel} disabled={busy}>
              Cancel booking
            </button>
          )}
          <p className="w-full text-center text-xs text-slate-500">Take a screenshot or keep your code to check or cancel later.</p>
        </div>
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
