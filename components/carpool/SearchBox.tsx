"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Search } from "lucide-react";
import { KindTabs } from "@/components/carpool/KindTabs";
import { PlacePicker } from "@/components/carpool/PlacePicker";
import type { RideKind } from "@/lib/cities";
import { formatDate, todayLocal } from "@/lib/format";
import { encodePoint, type Point } from "@/lib/places";
import { addDays } from "@/lib/schedule";

/** Pickup, drop-off and day; goes to /search. */
export function SearchBox({
  from: initialFrom = null,
  to: initialTo = null,
  date: initialDate = "",
  kind: initialKind = "city",
}: {
  from?: Point | null;
  to?: Point | null;
  date?: string;
  kind?: RideKind;
}) {
  const [kind, setKind] = useState<RideKind>(initialKind);
  const router = useRouter();
  const [from, setFrom] = useState<Point | null>(initialFrom);
  const [to, setTo] = useState<Point | null>(initialTo);
  const [date, setDate] = useState(initialDate);
  const today = todayLocal();
  const days = [
    ["", "Any day"],
    [today, "Today"],
    [addDays(today, 1), "Tomorrow"],
  ] as const;

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (from) q.set("from", encodePoint(from));
    if (to) q.set("to", encodePoint(to));
    if (date) q.set("date", date);
    if (kind === "intercity") q.set("kind", kind);
    router.push(`/search?${q}`);
  };

  return (
    <form onSubmit={go} className="space-y-3 rounded-3xl bg-white p-4 text-ink shadow-lift sm:p-5">
      <KindTabs
        value={kind}
        onChange={(k) => {
          if (k === kind) return;
          setKind(k);
          // A city spot works for both; a town far away doesn't belong in a city search.
          setFrom(null);
          setTo(null);
        }}
      />
      <div className="relative space-y-3">
        <PlacePicker label="Pickup" icon="start" scope={kind} value={from} onChange={setFrom} placeholder={kind === "city" ? "Where are you?" : "Leaving from which city?"} />
        <PlacePicker label="Drop-off" icon="end" scope={kind} value={to} onChange={setTo} placeholder={kind === "city" ? "Where are you going?" : "Going to which city?"} />
        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="absolute right-12 top-[3.35rem] z-10 grid size-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-ink"
          aria-label="Swap pickup and drop-off"
        >
          <ArrowUpDown className="size-4" />
        </button>
      </div>
      <div>
        <span className="label">When</span>
        <div className="flex flex-wrap gap-2">
          {days.map(([d, l]) => (
            <button
              key={l}
              type="button"
              onClick={() => setDate(d)}
              aria-pressed={date === d}
              className={`rounded-xl border-2 px-3 py-1.5 text-sm font-semibold ${date === d ? "border-brand bg-brand-lt/50 text-brand-dk" : "border-slate-200 text-slate-600"}`}
            >
              {l}
            </button>
          ))}
          <input
            type="date"
            aria-label="Another day"
            min={today}
            value={days.some(([d]) => d === date) ? "" : date}
            onChange={(e) => setDate(e.target.value)}
            className={`rounded-xl border-2 px-2 py-1 text-sm font-semibold ${date && !days.some(([d]) => d === date) ? "border-brand bg-brand-lt/50" : "border-slate-200 text-slate-500"}`}
          />
        </div>
        {date && !days.some(([d]) => d === date) && <p className="mt-1 text-xs text-slate-500">{formatDate(date, true)}</p>}
      </div>
      <button className="btn-primary w-full py-3.5 text-base">
        <Search className="size-5" /> Find a ride
      </button>
    </form>
  );
}
