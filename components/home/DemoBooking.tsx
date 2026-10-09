"use client";

import { useMemo, useState } from "react";
import { CircleCheckBig, MapPin, RefreshCw } from "lucide-react";
import { GenderIcon, SeatLegend, SeatMap, type SeatState } from "@/components/SeatMap";
import { formatFare } from "@/lib/format";
import { checkSeat, findSeat, hiaceLayout, seatFare, type Gender, type Taken } from "@/lib/layout";

const TAKEN: Taken = { "0-3": "female", "1-0": "female", "3-0": "male", "4-2": "male", "4-3": "male" };
const TRIP_FARE = 300;

/** A working, offline copy of the student booking screen for the home page. Nothing is saved. */
export function DemoBooking() {
  const layout = useMemo(() => {
    const l = hiaceLayout();
    l.cells[0][2] = { ...l.cells[0][2], fare: 400 };
    l.cells[0][3] = { ...l.cells[0][3], fare: 400 };
    return l;
  }, []);
  const [gender, setGender] = useState<Gender>("female");
  const [seat, setSeat] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const valid = seat && checkSeat(layout, TAKEN, seat, gender).ok ? seat : null;

  const seatState = (id: string): SeatState => {
    if (booked && id === valid) return { state: "selected" };
    const taken = TAKEN[id];
    if (taken) return { state: "taken", takenBy: taken, title: `Taken by a ${taken} passenger` };
    if (booked) return { state: "free" };
    const check = checkSeat(layout, TAKEN, id, gender);
    if (!check.ok) return { state: "blocked", title: check.reason };
    return { state: id === valid ? "selected" : "free" };
  };

  const label = valid ? findSeat(layout, valid)?.label : null;
  const fare = valid ? seatFare(layout, valid, TRIP_FARE) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="bg-brand px-4 pb-4 pt-3 text-white">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-200">To University · Mon, 12 Oct</div>
        <div className="text-lg font-bold">Morning van</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-teal-100">
          <MapPin className="size-3.5" /> Saddar Chowk · 7:10 AM
        </div>
      </div>

      {booked && valid ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
          <CircleCheckBig className="size-14 animate-pop text-emerald-500" />
          <div className="animate-rise">
            <div className="text-lg font-bold">Seat {label} is yours!</div>
            <div className="text-sm text-slate-500">
              Saddar Chowk · 7:10 AM{fare !== null && ` · ${formatFare(fare)}`}
            </div>
          </div>
          <div className="animate-rise rounded-xl border-2 border-dashed border-brand/40 px-6 py-2 font-mono text-2xl font-bold tracking-[0.3em] text-brand [animation-delay:120ms]">
            K7QM
          </div>
          <button
            type="button"
            className="btn-ghost mt-2 text-xs"
            onClick={() => {
              setBooked(false);
              setSeat(null);
            }}
          >
            <RefreshCw className="size-3.5" /> Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3 p-3">
          <div className="grid grid-cols-2 gap-2">
            {(["female", "male"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                aria-pressed={gender === g}
                className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-semibold transition ${
                  gender === g ? (g === "female" ? "border-female bg-female-lt text-female" : "border-male bg-male-lt text-male") : "border-slate-200 text-slate-500"
                }`}
              >
                <GenderIcon gender={g} className="size-4" />
                {g === "female" ? "Female" : "Male"}
              </button>
            ))}
          </div>
          <SeatMap layout={layout} seatState={seatState} onSelect={setSeat} compact />
          <div className="text-[11px] [&_ul]:gap-x-3">
            <SeatLegend items={["female", "male", "takenF", "takenM", "blocked"]} />
          </div>
          <button type="button" className="btn-primary mt-auto w-full py-3" disabled={!valid} onClick={() => setBooked(true)}>
            {valid ? `Book seat ${label}${fare !== null ? ` · ${formatFare(fare)}` : ""}` : "Tap a free seat"}
          </button>
        </div>
      )}
    </div>
  );
}
