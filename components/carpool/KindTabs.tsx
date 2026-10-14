"use client";

import { Building2, Route } from "lucide-react";
import type { RideKind } from "@/lib/cities";

/** "In the city" (Islamabad, Rawalpindi, Wah, Taxila, Rawat) or "Between cities" (all of Pakistan). */
export function KindTabs({ value, onChange, disabled = false }: { value: RideKind; onChange: (k: RideKind) => void; disabled?: boolean }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 text-sm font-semibold" role="tablist" aria-label="Type of ride">
      {(
        [
          ["city", "In the city", Building2],
          ["intercity", "Between cities", Route],
        ] as const
      ).map(([k, l, Icon]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          disabled={disabled && value !== k}
          onClick={() => onChange(k)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 transition disabled:opacity-40 ${value === k ? "bg-white text-brand-dk shadow-sm" : "text-slate-500 hover:text-ink"}`}
        >
          <Icon className="size-4" /> {l}
        </button>
      ))}
    </div>
  );
}

export const KIND_HINT: Record<RideKind, string> = {
  city: "Islamabad, Rawalpindi, Wah, Taxila & Rawat",
  intercity: "Between cities, all over Pakistan",
};
