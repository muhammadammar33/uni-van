"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Flag, KeyRound, Lock, Play, UserX } from "lucide-react";
import type { ManageData } from "@/lib/rides";

/**
 * Today's trip for the driver: pickup by pickup, who's on board. The driver can only start the ride from a
 * pickup (or leave a later one) once every rider getting on there has entered the ride code, or isn't there.
 */
export function TripPanel({ token, data }: { token: string; data: ManageData }) {
  const router = useRouter();
  const { trip, points, rideCodes } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = trip ? data.bookings.filter((b) => b.date === trip.date) : [];
  const stops = [...new Set(today.map((b) => b.pickupIdx))].sort((a, b) => a - b);
  const next = trip ? stops.find((i) => i > trip.leftIdx) : undefined;
  const here = today.filter((b) => b.pickupIdx === next);
  const waiting = here.filter((b) => !b.boarded && !b.noShow);

  // While riders are entering the code, show it as it happens.
  useEffect(() => {
    if (!waiting.length) return;
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 5000);
    return () => clearInterval(t);
  }, [waiting.length, router]);

  if (!trip || !today.length || data.ride.status !== "active") return null;

  async function act(body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rides/manage/${token}/trip`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error ?? "Couldn't update the trip.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const left = stops.filter((i) => i <= trip.leftIdx);
  const first = trip.leftIdx < 0;

  return (
    <section className="card space-y-3" aria-labelledby="trip-title">
      <h2 id="trip-title" className="flex items-center gap-2 font-bold">
        <Flag className="size-5 text-brand" /> Today&apos;s trip
      </h2>
      {left.map((i) => (
        <p key={i} className="flex items-center gap-2 text-sm text-slate-500">
          <CircleCheckBig className="size-4 text-emerald-600" /> Left {points[i].name}
        </p>
      ))}
      {next === undefined ? (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">All riders are picked up. Drive safe!</p>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-xl bg-brand-lt/40 px-3 py-2">
            <KeyRound className="size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1 text-xs text-slate-600">
              At <b className="text-ink">{points[next].name}</b>, tell each rider the ride code. They enter it on their ticket.
            </div>
            <span className="font-mono text-2xl font-extrabold tracking-[0.2em] text-brand-dk">{rideCodes[trip.date]}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {here.map((b) => (
              <li key={b.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {b.name}
                  {b.seats > 1 && <span className="font-normal text-slate-500"> · {b.seats} seats</span>}
                </span>
                {b.boarded ? (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">On board ✓</span>
                ) : b.noShow ? (
                  <>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Not here</span>
                    <button type="button" className="shrink-0 text-xs font-semibold text-brand underline" disabled={busy} onClick={() => act({ action: "noshow", bookingId: b.id, undo: true })}>
                      Undo
                    </button>
                  </>
                ) : (
                  <>
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">Waiting for code</span>
                    <button
                      type="button"
                      className="grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 hover:text-red-600"
                      aria-label={`${b.name} isn't here`}
                      title="Not here"
                      disabled={busy}
                      onClick={() => confirm(`Mark ${b.name.split(" ")[0]} as not here? Only if they didn't come.`) && act({ action: "noshow", bookingId: b.id })}
                    >
                      <UserX className="size-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary w-full py-3" disabled={busy || waiting.length > 0} onClick={() => act({ action: "leave", stopIdx: next })}>
            {waiting.length ? <Lock className="size-4" /> : <Play className="size-4" />}
            {first ? `Start the ride from ${points[next].name}` : `Leave ${points[next].name}`}
          </button>
          {waiting.length > 0 && (
            <p className="text-xs text-slate-500">
              Unlocks when everyone here has entered the ride code. This keeps riders safe: they know it&apos;s really you. If someone didn&apos;t come, mark them as not here.
            </p>
          )}
        </>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
