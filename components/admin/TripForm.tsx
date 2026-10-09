"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { FormState } from "@/app/admin/actions";
import { defaultTitle } from "@/lib/format";

type StopRow = { key: string; id?: number; name: string; time: string };

export type TripFormValues = {
  title: string;
  direction: "to_uni" | "to_home";
  date: string;
  departTime: string;
  closesAt: string;
  notes: string;
  stops: { id?: number; name: string; time: string }[];
};

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export function TripForm({
  action,
  initial,
  vehicles,
  submitLabel,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  initial: TripFormValues;
  /** Only when creating: the seating plan to start from. */
  vehicles?: { id: number; name: string; seats: number }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [direction, setDirection] = useState(initial.direction);
  const [date, setDate] = useState(initial.date);
  const [stops, setStops] = useState<StopRow[]>(() =>
    initial.stops.length ? initial.stops.map((s) => ({ ...s, key: newKey() })) : [{ key: newKey(), name: "", time: "" }],
  );
  const toHome = direction === "to_home";

  const update = (key: string, patch: Partial<StopRow>) => setStops((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setStops((rows) => {
      const next = [...rows];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="stops" value={JSON.stringify(stops.map(({ id, name, time }) => ({ id, name, time })))} />

      <section className="card space-y-4">
        <div>
          <span className="label">Direction</span>
          <div className="grid grid-cols-2 gap-2">
            {(["to_uni", "to_home"] as const).map((d) => (
              <label
                key={d}
                className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-center font-semibold transition ${
                  direction === d ? "border-brand bg-brand-lt/40 text-brand-dk" : "border-slate-200 text-slate-600"
                }`}
              >
                <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
                {d === "to_uni" ? "Home → University" : "University → Home"}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input id="date" name="date" type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="departTime">
              {toHome ? "Leaves university at" : "Departure time"} <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="departTime" name="departTime" type="time" className="input" defaultValue={initial.departTime} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">
            Title <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="title" name="title" className="input" defaultValue={initial.title} placeholder={date ? defaultTitle(direction, date) : "Van to university"} maxLength={100} />
        </div>
        {vehicles && (
          <div>
            <label className="label" htmlFor="vehicleId">
              Vehicle
            </label>
            <select id="vehicleId" name="vehicleId" className="input" required defaultValue={vehicles[0]?.id}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.seats} seats
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">The trip gets its own copy of the seating, which you can adjust after creating it.</p>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">{toHome ? "Drop-off points" : "Pickup points"}</h2>
        <p className="mb-4 text-sm text-slate-500">
          In route order, with the {toHome ? "expected drop-off" : "pickup"} time students will see.
        </p>
        <ol className="space-y-2">
          {stops.map((st, i) => (
            <li key={st.key} className="flex items-center gap-2">
              <span className="w-5 text-right text-sm text-slate-400">{i + 1}</span>
              <input
                className="input flex-1"
                placeholder="Stop name, e.g. Saddar Chowk"
                aria-label={`Stop ${i + 1} name`}
                value={st.name}
                onChange={(e) => update(st.key, { name: e.target.value })}
                required
              />
              <input
                type="time"
                className="input !w-32"
                aria-label={`Stop ${i + 1} time`}
                value={st.time}
                onChange={(e) => update(st.key, { time: e.target.value })}
                required
              />
              <div className="flex">
                <button type="button" className="p-1.5 text-slate-400 hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-ink disabled:opacity-30"
                  disabled={i === stops.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                  disabled={stops.length === 1}
                  onClick={() => setStops((rows) => rows.filter((r) => r.key !== st.key))}
                  aria-label="Remove stop"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn-ghost mt-3" onClick={() => setStops((rows) => [...rows, { key: newKey(), name: "", time: "" }])}>
          <Plus className="size-4" /> Add stop
        </button>
      </section>

      <section className="card space-y-4">
        <div>
          <label className="label" htmlFor="closesAt">
            Stop booking at <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="closesAt" name="closesAt" type="datetime-local" className="input sm:!w-72" defaultValue={initial.closesAt} />
          <p className="mt-1 text-xs text-slate-500">Leave empty to keep booking open until you close it (it closes by itself after the trip date).</p>
        </div>
        <div>
          <label className="label" htmlFor="notes">
            Note for students <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea id="notes" name="notes" rows={3} className="input" defaultValue={initial.notes} placeholder="e.g. Fare Rs. 300, pay the driver. Van will not wait more than 2 minutes." />
        </div>
      </section>

      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary px-6" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
