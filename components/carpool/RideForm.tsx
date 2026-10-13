"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CircleAlert, Plus, Trash2 } from "lucide-react";
import { MapView } from "@/components/carpool/MapView";
import { PlacePicker } from "@/components/carpool/PlacePicker";
import { GenderIcon } from "@/components/SeatMap";
import { todayLocal } from "@/lib/format";
import type { Gender } from "@/lib/layout";
import type { Point } from "@/lib/places";
import { WEEKDAYS } from "@/lib/schedule";

export type RideFormValues = {
  driverName: string;
  driverPhone: string;
  driverGender: Gender | null;
  car: string;
  plate: string;
  seats: number;
  fare: string;
  riders: "anyone" | "female" | "male";
  departTime: string;
  schedule: "once" | "daily" | "weekly";
  date: string;
  days: number[];
  until: string;
  notes: string;
  points: (Point | null)[];
};

export const emptyRide = (): RideFormValues => ({
  driverName: "",
  driverPhone: "",
  driverGender: null,
  car: "",
  plate: "",
  seats: 3,
  fare: "",
  riders: "anyone",
  departTime: "08:00",
  schedule: "weekly",
  date: todayLocal(),
  days: [1, 2, 3, 4, 5],
  until: "",
  notes: "",
  points: [null, null],
});

const MY_RIDES = "hamsafar:my-rides";
export function rememberRide(r: { slug: string; token: string; title: string }) {
  try {
    const list = JSON.parse(localStorage.getItem(MY_RIDES) ?? "[]") as { slug: string; token: string; title: string }[];
    localStorage.setItem(MY_RIDES, JSON.stringify([r, ...list.filter((x) => x.slug !== r.slug)].slice(0, 20)));
  } catch {}
}
export function myRides(): { slug: string; token: string; title: string }[] {
  try {
    return JSON.parse(localStorage.getItem(MY_RIDES) ?? "[]");
  } catch {
    return [];
  }
}

/** Create a ride (no token) or edit one (with the manage token). */
export function RideForm({
  initial,
  token,
  lockedRoute = false,
  onSaved,
}: {
  initial?: RideFormValues;
  token?: string;
  lockedRoute?: boolean;
  /** Called after an edit is saved (before the page refreshes). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<RideFormValues>(() => initial ?? emptyRide());
  // A returning driver's details, remembered on this phone.
  useEffect(() => {
    if (initial) return;
    try {
      const me = JSON.parse(localStorage.getItem("hamsafar:driver") ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
      if (me) setV((cur) => ({ ...cur, driverName: me.driverName ?? "", driverPhone: me.driverPhone ?? "", driverGender: me.driverGender ?? null, car: me.car ?? "", plate: me.plate ?? "" }));
    } catch {}
  }, [initial]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<RideFormValues>) => setV((cur) => ({ ...cur, ...patch }));
  const setPoint = (i: number, p: Point | null) => set({ points: v.points.map((x, j) => (j === i ? p : x)) });
  const route = v.points.filter((p): p is Point => !!p);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (v.points.some((p) => !p)) return setError("Choose every location of the route (or remove the empty stop).");
    if (!v.driverGender) return setError("Choose male or female.");
    setBusy(true);
    try {
      const body = { ...v, fare: v.fare.trim() === "" ? "" : Number(v.fare), until: v.until || "", points: route };
      const res = await fetch(token ? `/api/rides/manage/${token}` : "/api/rides", {
        method: token ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't save. Please try again.");
      try {
        localStorage.setItem("hamsafar:driver", JSON.stringify({ driverName: v.driverName, driverPhone: v.driverPhone, driverGender: v.driverGender, car: v.car, plate: v.plate }));
      } catch {}
      if (token) {
        onSaved?.();
        router.push(`/r/manage/${token}?saved=1`);
        router.refresh();
      } else {
        rememberRide({ slug: json.slug, token: json.manageToken, title: `${route[0].name} → ${route[route.length - 1].name}` });
        router.push(`/r/manage/${json.manageToken}?new=1`);
      }
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Route</h2>
        {lockedRoute && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Riders have booked upcoming days, so the route is locked. You can still change the time, seats, fare and notes.</p>}
        <div className="space-y-3">
          {v.points.map((p, i) => {
            const first = i === 0;
            const last = i === v.points.length - 1;
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <PlacePicker
                    label={first ? "Starting point" : last ? "Final destination" : `Stop ${i}`}
                    icon={first ? "start" : last ? "end" : "stop"}
                    value={p}
                    onChange={(x) => !lockedRoute && setPoint(i, x)}
                    placeholder={first ? "Where do you start?" : last ? "Where do you end?" : "A place you pass on the way"}
                  />
                </div>
                {!first && !last && !lockedRoute && (
                  <div className="flex pb-1">
                    <button type="button" className="p-1.5 text-slate-400 hover:text-ink" aria-label="Move up" onClick={() => { const pts = [...v.points]; [pts[i - 1], pts[i]] = [pts[i], pts[i - 1]]; set({ points: pts }); }}>
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" className="p-1.5 text-slate-400 hover:text-ink" aria-label="Move down" onClick={() => { const pts = [...v.points]; [pts[i + 1], pts[i]] = [pts[i], pts[i + 1]]; set({ points: pts }); }}>
                      <ArrowDown className="size-4" />
                    </button>
                    <button type="button" className="p-1.5 text-slate-400 hover:text-red-600" aria-label="Remove stop" onClick={() => set({ points: v.points.filter((_, j) => j !== i) })}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!lockedRoute && v.points.length < 12 && (
          <button type="button" className="btn-ghost" onClick={() => set({ points: [...v.points.slice(0, -1), null, v.points[v.points.length - 1]] })}>
            <Plus className="size-4" /> Add a stop on the way
          </button>
        )}
        <p className="text-xs text-slate-500">Add the places you pass, so riders along the way find your ride. Riders within about 3 km of your route can join.</p>
        {route.length > 0 && <MapView className="h-56" routes={[{ points: route }]} fitKey={route.map((p) => `${p.lat},${p.lng}`).join(";")} />}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">When</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["once", "One day"],
              ["daily", "Every day"],
              ["weekly", "Chosen days"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ schedule: k })}
              aria-pressed={v.schedule === k}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${v.schedule === k ? "border-brand bg-brand-lt/40 text-brand-dk" : "border-slate-200 text-slate-600"}`}
            >
              {l}
            </button>
          ))}
        </div>
        {v.schedule === "weekly" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = v.days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ days: on ? v.days.filter((x) => x !== d) : [...v.days, d] })}
                  className={`min-w-12 flex-1 rounded-xl border-2 py-2 text-sm font-bold ${on ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-500"}`}
                >
                  {WEEKDAYS[d]}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="date">
              {v.schedule === "once" ? "Date" : "Starting from"}
            </label>
            <input id="date" type="date" required className="input" value={v.date} min={token ? undefined : todayLocal()} onChange={(e) => set({ date: e.target.value })} />
          </div>
          {v.schedule !== "once" && (
            <div>
              <label className="label" htmlFor="until">
                Until <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input id="until" type="date" className="input" value={v.until} min={v.date} onChange={(e) => set({ until: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="departTime">
              Leaving at
            </label>
            <input id="departTime" type="time" required className="input" value={v.departTime} onChange={(e) => set({ departTime: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Car & seats</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="car">
              Car
            </label>
            <input id="car" required className="input" value={v.car} onChange={(e) => set({ car: e.target.value })} placeholder="e.g. Suzuki Cultus, white" maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="plate">
              Number plate <span className="font-normal text-slate-400">(shown after booking)</span>
            </label>
            <input id="plate" className="input" value={v.plate} onChange={(e) => set({ plate: e.target.value })} placeholder="e.g. LEB-1234" maxLength={20} />
          </div>
          <div>
            <label className="label" htmlFor="seats">
              Seats for riders
            </label>
            <select id="seats" className="input" value={v.seats} onChange={(e) => set({ seats: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fare">
              Fare per seat (Rs.) <span className="font-normal text-slate-400">(empty = free / agree later)</span>
            </label>
            <input id="fare" type="number" inputMode="numeric" min={0} className="input" value={v.fare} onChange={(e) => set({ fare: e.target.value })} placeholder="e.g. 250" />
          </div>
        </div>
        <div>
          <span className="label">Who can ride with you</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["anyone", "Anyone"],
                ["female", "Women only"],
                ["male", "Men only"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={v.riders === k}
                onClick={() => set({ riders: k })}
                className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${v.riders === k ? "border-brand bg-brand-lt/40 text-brand-dk" : "border-slate-200 text-slate-600"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="notes">
            Note for riders <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea id="notes" rows={2} className="input" value={v.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. AC car, no smoking. I wait 2 minutes at each stop." maxLength={1000} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="driverName">
              Your name
            </label>
            <input id="driverName" required className="input" autoComplete="name" value={v.driverName} onChange={(e) => set({ driverName: e.target.value })} maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="driverPhone">
              Phone (WhatsApp) <span className="font-normal text-slate-400">(shown only to riders who book)</span>
            </label>
            <input id="driverPhone" required type="tel" inputMode="tel" autoComplete="tel" className="input" value={v.driverPhone} onChange={(e) => set({ driverPhone: e.target.value })} placeholder="0300 1234567" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={v.driverGender === g}
              onClick={() => set({ driverGender: g })}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 font-semibold ${
                v.driverGender === g ? (g === "female" ? "border-female bg-female-lt text-female" : "border-male bg-male-lt text-male") : "border-slate-200 text-slate-600"
              }`}
            >
              <span aria-hidden><GenderIcon gender={g} className="size-4" /></span> {g === "female" ? "Female" : "Male"}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <button className="btn-primary w-full py-3.5 text-base" disabled={busy}>
        {busy ? "Saving…" : token ? "Save changes" : "Publish my ride"}
      </button>
      {!token && <p className="text-center text-xs text-slate-500">No account needed. You get a private link to manage your ride: keep it safe.</p>}
    </form>
  );
}
