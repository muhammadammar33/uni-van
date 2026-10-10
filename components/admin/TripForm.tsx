"use client";

import { useActionState, useState } from "react";
import { keepFields } from "@/lib/keepFields";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { FormState } from "@/app/admin/actions";
import { defaultTitle } from "@/lib/format";
import { orgInfo, type OrgType } from "@/lib/orgTypes";

type StopRow = { key: string; id?: number; name: string; time: string };

export type TripFormValues = {
  title: string;
  direction: "to_uni" | "to_home";
  date: string;
  /** Last day of a multi-day trip, "" for same-day. */
  endDate: string;
  genderRule: "separate" | "none";
  maxSeats: number;
  membersOnly: boolean;
  departTime: string;
  closesAt: string;
  notes: string;
  /** Rupees as typed; "" = no fare */
  fare: string;
  stops: { id?: number; name: string; time: string }[];
};

let keySeq = 0;
const newKey = () => `k${++keySeq}`;

export function TripForm({
  action,
  initial,
  vehicles,
  submitLabel,
  orgType,
}: {
  orgType: OrgType;
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
  const [genderRule, setGenderRule] = useState(initial.genderRule);
  const toHome = direction === "to_home";
  const info = orgInfo(orgType);

  const update = (key: string, patch: Partial<StopRow>) => setStops((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setStops((rows) => {
      const next = [...rows];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <form onSubmit={keepFields(formAction)} className="space-y-5">
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
                {info.direction[d]}
                <span className="block text-xs font-medium text-slate-500">Stops are {d === "to_uni" ? "pickup" : "drop-off"} points</span>
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
          {info.multiDay && (
            <div>
              <label className="label" htmlFor="endDate">
                Last day <span className="font-normal text-slate-400">(for trips of more than one day)</span>
              </label>
              <input id="endDate" name="endDate" type="date" min={date} className="input" defaultValue={initial.endDate} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="departTime">
              Departure time <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input id="departTime" name="departTime" type="time" className="input" defaultValue={initial.departTime} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">
            Title <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="title" name="title" className="input" defaultValue={initial.title} placeholder={date ? defaultTitle(direction, date, orgType) : ""} maxLength={100} />
        </div>
        <div>
          <label className="label" htmlFor="fare">
            Fare per seat (Rs.) <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="fare" name="fare" type="number" inputMode="numeric" min={0} step={1} className="input sm:!w-48" defaultValue={initial.fare} placeholder="e.g. 300" />
          <p className="mt-1 text-xs text-slate-500">Students see it before booking. Give single seats a different price under Seating.</p>
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
          In route order, with the {toHome ? "expected drop-off" : "pickup"} time {info.riders} will see.
        </p>
        <ol className="space-y-2">
          {stops.map((st, i) => (
            <li key={st.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2 sm:flex-nowrap sm:bg-transparent sm:p-0">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-lt text-xs font-bold text-brand-dk">{i + 1}</span>
              <input
                className="input min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-auto"
                placeholder="Stop name, e.g. Saddar Chowk"
                aria-label={`Stop ${i + 1} name`}
                value={st.name}
                onChange={(e) => update(st.key, { name: e.target.value })}
                required
              />
              <input
                type="time"
                className="input ml-8 !w-32 sm:ml-0"
                aria-label={`Stop ${i + 1} time`}
                value={st.time}
                onChange={(e) => update(st.key, { time: e.target.value })}
                required
              />
              <div className="ml-auto flex sm:ml-0">
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
        <h2 className="font-semibold">Booking rules</h2>
        <div>
          <span className="label">Seating</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["separate", "Males and females apart", "Seats can be female-only or male-only, and opposite genders are never booked side by side."],
                ["none", "No restriction", "Anyone can sit anywhere. Good for families and groups on tours."],
              ] as const
            ).map(([value, title, text]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border-2 p-3 transition ${genderRule === value ? "border-brand bg-brand-lt/40" : "border-slate-200"}`}
              >
                <input type="radio" name="genderRule" value={value} checked={genderRule === value} onChange={() => setGenderRule(value)} className="sr-only" />
                <span className="block font-semibold">{title}</span>
                <span className="block text-xs text-slate-500">{text}</span>
              </label>
            ))}
          </div>
        </div>
        {genderRule === "none" && (
          <div>
            <label className="label" htmlFor="maxSeats">
              Seats one person can book at once
            </label>
            <select id="maxSeats" name="maxSeats" className="input sm:!w-48" defaultValue={String(initial.maxSeats)}>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 seat" : `Up to ${n} seats`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">e.g. a family of four books four seats together under one name and phone number.</p>
          </div>
        )}
        {info.roster && (
          <label className="flex items-start gap-3 rounded-xl bg-violet-50 p-3">
            <input type="checkbox" name="membersOnly" defaultChecked={initial.membersOnly} className="mt-1 size-4 accent-brand" />
            <span>
              <span className="block font-semibold">Registered {info.riders} only</span>
              <span className="block text-xs text-slate-600">
                Only {info.riders} on your list can book. They enter their phone number{info.refLabel ? ` and ${info.refLabel.toLowerCase()}` : ""}; their name and gender come from the list.
              </span>
            </span>
          </label>
        )}
        <div>
          <label className="label" htmlFor="closesAt">
            Stop booking at <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="closesAt" name="closesAt" type="datetime-local" className="input sm:!w-72" defaultValue={initial.closesAt} />
          <p className="mt-1 text-xs text-slate-500">Leave empty to keep booking open until you close it (it closes by itself after the trip date).</p>
        </div>
        <div>
          <label className="label" htmlFor="notes">
            {info.multiDay ? "Details & itinerary" : `Note for ${info.riders}`} <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={info.multiDay ? 6 : 3}
            className="input"
            defaultValue={initial.notes}
            placeholder={
              info.multiDay
                ? "Day 1: Islamabad → Naran, stay at hotel\nDay 2: Lake Saif-ul-Malook, Babusar Top\nDay 3: Return\nIncludes: transport, hotel, breakfast"
                : "e.g. Fare Rs. 300, pay the driver. Van will not wait more than 2 minutes."
            }
          />
        </div>
      </section>

      {state?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <div className="flex justify-end">
        <button className="btn-primary w-full px-8 py-3 text-base sm:w-auto" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
