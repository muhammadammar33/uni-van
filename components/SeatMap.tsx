"use client";

import { DoorOpen, Lock, Mars, Venus } from "lucide-react";
import type { Cell, Gender, Layout, SeatGender } from "@/lib/layout";
import { seatId, seatList } from "@/lib/layout";

export type SeatState = {
  /** free: can be picked · selected: picked · taken: booked · blocked: not allowed for this passenger */
  state: "free" | "selected" | "taken" | "blocked";
  /** Gender of the passenger in a taken seat. */
  takenBy?: Gender;
  /** Tooltip, e.g. why a seat is blocked or who is sitting there. */
  title?: string;
  /** Small text under the seat number (admin: passenger name). */
  caption?: string;
};

const RESERVED_RING: Record<SeatGender, string> = {
  male: "border-male",
  female: "border-female",
  any: "border-slate-300",
};

export function SteeringWheel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="M3.5 10.5 10 12M20.5 10.5 14 12M12 14v7" />
    </svg>
  );
}

/** Non-seat cells (driver, door, aisle) for both the booking map and the editor. */
export function FixtureCell({ cell }: { cell: Cell }) {
  if (cell.kind === "driver")
    return (
      <div className="flex size-full flex-col items-center justify-center rounded-xl bg-slate-800 text-[10px] font-medium text-slate-200">
        <SteeringWheel className="size-5" />
        Driver
      </div>
    );
  if (cell.kind === "door")
    return (
      <div className="flex size-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-[10px] text-slate-400">
        <DoorOpen className="size-4" />
        Door
      </div>
    );
  return <div className="size-full" />;
}

export function GenderIcon({ gender, className }: { gender: Gender; className?: string }) {
  return gender === "female" ? <Venus className={className} aria-label="Female" /> : <Mars className={className} aria-label="Male" />;
}

/** The vehicle seen from above, front at the top: windscreen, mirrors and a rear bumper. */
export function VehicleFrame({ cols, children, compact = false }: { cols: number; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className="relative mx-auto w-fit px-2">
      {/* Mirrors */}
      <span className="absolute left-0 top-10 h-5 w-2.5 rounded-l-md bg-slate-300" />
      <span className="absolute right-0 top-10 h-5 w-2.5 rounded-r-md bg-slate-300" />
      <div className={`rounded-b-3xl rounded-t-[2.5rem] border-[3px] border-slate-300 bg-gradient-to-b from-white to-slate-50 shadow-[inset_0_2px_8px_rgb(15_23_42/0.06)] ${compact ? "px-2.5 pb-3 pt-2" : "px-3 pb-4 pt-2.5 sm:px-4"}`}>
        <div className="mx-3 mb-3 rounded-b-xl rounded-t-[1.5rem] bg-gradient-to-b from-sky-100 to-sky-50 py-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700/60">
          Front
        </div>
        <div className={`grid ${compact ? "gap-1.5" : "gap-1.5 sm:gap-2"}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {children}
        </div>
      </div>
      {/* Rear bumper */}
      <div className="mx-auto -mt-1 h-2 w-3/4 rounded-b-lg bg-slate-300" />
    </div>
  );
}

const CELL = "size-12 sm:size-14";
const CELL_COMPACT = "size-11";

export function SeatMap({
  layout,
  seatState,
  onSelect,
  selectTaken = false,
  compact = false,
}: {
  layout: Layout;
  seatState: (id: string) => SeatState;
  onSelect?: (id: string) => void;
  /** Let taken seats be clicked too (admin: open the passenger). */
  selectTaken?: boolean;
  /** Smaller seats, e.g. inside the phone picture on the home page. */
  compact?: boolean;
}) {
  const cellSize = compact ? CELL_COMPACT : CELL;
  const labels = new Map(seatList(layout).map((s) => [s.id, s.label]));
  return (
    <VehicleFrame cols={layout.cols} compact={compact}>
      {layout.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const id = seatId(r, c);
          if (cell.kind !== "seat")
            return (
              <div key={id} className={cellSize}>
                <FixtureCell cell={cell} />
              </div>
            );
          const st = seatState(id);
          const reserved = cell.gender ?? "any";
          const clickable = !!onSelect && (st.state === "free" || st.state === "selected" || (selectTaken && st.state === "taken"));
          return (
            <button
              key={id}
              type="button"
              disabled={!clickable}
              title={st.title}
              onClick={() => onSelect?.(id)}
              aria-pressed={st.state === "selected"}
              aria-label={`Seat ${labels.get(id)}${st.title ? `: ${st.title}` : ""}`}
              className={[
                cellSize,
                "relative flex flex-col items-center justify-center rounded-t-2xl rounded-b-lg border-2 text-sm font-bold transition",
                st.state === "selected" && "scale-105 border-brand bg-brand text-white shadow-lg",
                st.state === "free" && `${RESERVED_RING[reserved]} bg-white text-slate-700`,
                st.state === "free" && clickable && "hover:-translate-y-0.5 hover:shadow",
                st.state === "taken" && st.takenBy === "female" && "border-female/40 bg-female-lt text-female",
                st.state === "taken" && st.takenBy === "male" && "border-male/40 bg-male-lt text-male",
                st.state === "taken" && !st.takenBy && "border-slate-300 bg-slate-200 text-slate-500",
                st.state === "blocked" && "seat-blocked border-slate-200 bg-slate-50 text-slate-300",
                !clickable && "cursor-default",
                clickable && st.state === "taken" && "hover:ring-2 hover:ring-slate-300",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Backrest */}
              <span
                className={[
                  "absolute inset-x-2 top-1 h-1 rounded-full",
                  reserved === "female" ? "bg-female/60" : reserved === "male" ? "bg-male/60" : "bg-slate-200",
                  st.state === "selected" && "bg-white/70",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              {st.state === "taken" && st.takenBy ? (
                <GenderIcon gender={st.takenBy} className="size-4" />
              ) : st.state === "blocked" ? (
                <Lock className="size-3.5" />
              ) : (
                <span>{labels.get(id)}</span>
              )}
              {st.caption && <span className="max-w-full truncate px-0.5 text-[9px] font-medium leading-tight">{st.caption}</span>}
            </button>
          );
        }),
      )}
    </VehicleFrame>
  );
}

export function SeatLegend({ items }: { items: ("female" | "male" | "any" | "selected" | "takenF" | "takenM" | "blocked")[] }) {
  const all = {
    female: ["border-female bg-white", "Females only"],
    male: ["border-male bg-white", "Males only"],
    any: ["border-slate-300 bg-white", "Anyone"],
    selected: ["border-brand bg-brand", "Your pick"],
    takenF: ["border-female/40 bg-female-lt", "Taken (female)"],
    takenM: ["border-male/40 bg-male-lt", "Taken (male)"],
    blocked: ["seat-blocked border-slate-200 bg-slate-50", "Not available to you"],
  } as const;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {items.map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`inline-block size-3.5 rounded border-2 ${all[k][0]}`} />
          {all[k][1]}
        </li>
      ))}
    </ul>
  );
}
