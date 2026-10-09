"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Bus, CalendarDays, Check, Clock, MapPin, MessageCircle, Phone, UserCheck } from "lucide-react";
import { GenderIcon } from "@/components/SeatMap";
import { DIRECTION_LABEL, displayPhone, formatDate, formatFare, formatTime } from "@/lib/format";
import type { DriverPassenger, DriverTrip } from "@/lib/trips";

const POLL_MS = 15_000;

type Field = "boarded" | "paid";

export function DriverView({ token, initial }: { token: string; initial: DriverTrip }) {
  const [trip, setTrip] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  /** Taps not yet confirmed by the server; they win over polled data so the screen doesn't flicker back. */
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/d/${token}`, { cache: "no-store" });
      if (res.ok) setTrip(await res.json());
    } catch {
      /* no signal on the road: keep the last list */
    }
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const value = (p: DriverPassenger, field: Field) => pending[`${p.id}:${field}`] ?? p[field];

  async function toggle(p: DriverPassenger, field: Field) {
    const key = `${p.id}:${field}`;
    const next = !value(p, field);
    setPending((m) => ({ ...m, [key]: next }));
    setError(null);
    try {
      const res = await fetch(`/api/d/${token}/mark`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: p.id, field, value: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save. Check your connection.");
      setTrip((t) => ({
        ...t,
        stops: t.stops.map((s) => ({ ...s, passengers: s.passengers.map((x) => (x.id === p.id ? { ...x, [field]: next } : x)) })),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending((m) => {
        const { [key]: _done, ...rest } = m; // eslint-disable-line @typescript-eslint/no-unused-vars
        return rest;
      });
    }
  }

  const all = trip.stops.flatMap((s) => s.passengers);
  const boarded = all.filter((p) => value(p, "boarded")).length;
  const expected = all.reduce((sum, p) => sum + (p.fare ?? 0), 0);
  const collected = all.reduce((sum, p) => sum + (value(p, "paid") ? (p.fare ?? 0) : 0), 0);
  const hasFares = all.some((p) => p.fare !== null);
  const toHome = trip.direction === "to_home";

  return (
    <main className="mx-auto max-w-lg pb-10">
      <header className="bg-slate-900 px-4 pb-4 pt-5 text-white">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-teal-300">
          <Bus className="size-4" /> Driver · {DIRECTION_LABEL[trip.direction]}
        </div>
        <h1 className="text-xl font-bold leading-tight">{trip.title}</h1>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-300">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" /> {formatDate(trip.date, true)}
          </span>
          {trip.departTime && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" /> {toHome ? "Leave university" : "Depart"} {formatTime(trip.departTime)}
            </span>
          )}
          <span>{trip.vehicleName}</span>
        </div>
      </header>

      <div className="sticky top-0 z-10 grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-white text-center shadow-sm">
        <Total label="Passengers" value={all.length} />
        <Total label="Boarded" value={`${boarded}/${all.length}`} />
        <Total label="Collected" value={hasFares ? `${collected.toLocaleString("en-US")}/${expected.toLocaleString("en-US")}` : "–"} />
      </div>

      {error && <p className="mx-4 mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <ol className="space-y-4 px-4 pt-4">
        {trip.stops.map((stop, i) => (
          <li key={stop.id} className={`card !p-0 ${stop.passengers.length ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{stop.name}</div>
                <div className="text-sm text-slate-500">
                  {formatTime(stop.time)} · {stop.passengers.length ? `${stop.passengers.length} ${toHome ? "to drop" : "to pick up"}` : "nobody"}
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.name)}`}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-slate-400 hover:text-ink"
                aria-label={`${stop.name} on the map`}
              >
                <MapPin className="size-5" />
              </a>
            </div>
            {stop.passengers.length > 0 && (
              <ul className="divide-y divide-slate-100">
                {stop.passengers.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-bold">{p.seatLabel}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-medium">
                          <GenderIcon gender={p.gender} className={`size-4 shrink-0 ${p.gender === "female" ? "text-female" : "text-male"}`} />
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="text-sm text-slate-500">
                          {displayPhone(p.phone)}
                          {p.fare !== null && ` · ${formatFare(p.fare)}`}
                        </div>
                      </div>
                      <a href={`tel:+${p.phone}`} className="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-600" aria-label={`Call ${p.name}`}>
                        <Phone className="size-4" />
                      </a>
                      <a
                        href={`https://wa.me/${p.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="grid size-10 place-items-center rounded-full border border-slate-200 text-[#128C7E]"
                        aria-label={`WhatsApp ${p.name}`}
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <Toggle on={value(p, "boarded")} onClick={() => toggle(p, "boarded")} icon={<UserCheck className="size-4" />} label={toHome ? "Dropped" : "Boarded"} />
                      <Toggle
                        on={value(p, "paid")}
                        onClick={() => toggle(p, "paid")}
                        icon={<Banknote className="size-4" />}
                        label={p.fare !== null ? `Paid ${formatFare(p.fare)}` : "Paid"}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-6 px-4 text-center text-xs text-slate-400">This page updates by itself. Don&apos;t share this link: it shows passengers&apos; phone numbers.</p>
    </main>
  );
}

function Total({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-2 py-2.5">
      <div className="text-lg font-bold leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center justify-center gap-1.5 rounded-lg border-2 py-2 text-sm font-semibold transition ${
        on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {on ? <Check className="size-4" /> : icon}
      {label}
    </button>
  );
}
