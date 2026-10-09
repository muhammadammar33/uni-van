"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Banknote, DoorOpen, Eraser, Lock, Mars, Minus, Plus, TriangleAlert, Venus } from "lucide-react";
import type { FormState } from "@/app/admin/actions";
import { FixtureCell, SteeringWheel, VehicleFrame } from "@/components/SeatMap";
import { emptyLayout, genderClashes, MAX_COLS, MAX_FARE, MAX_ROWS, seatId, seatList, type Cell, type Gender, type Layout, type SeatGender } from "@/lib/layout";

type Tool = { key: string; label: string; cell: Cell; icon: React.ReactNode };

/** Not a cell type: sets (or clears) the price of the seats it touches. */
const FARE_TOOL: Tool = { key: "fare", label: "Seat price", cell: { kind: "seat" }, icon: <Banknote className="size-4 text-emerald-700" /> };

const TOOLS: Tool[] = [
  { key: "female", label: "Female seat", cell: { kind: "seat", gender: "female" }, icon: <Venus className="size-4 text-female" /> },
  { key: "male", label: "Male seat", cell: { kind: "seat", gender: "male" }, icon: <Mars className="size-4 text-male" /> },
  { key: "any", label: "Seat for anyone", cell: { kind: "seat", gender: "any" }, icon: <span className="inline-block size-3.5 rounded border-2 border-slate-400" /> },
  { key: "empty", label: "Aisle / empty", cell: { kind: "empty" }, icon: <Eraser className="size-4" /> },
  { key: "door", label: "Door", cell: { kind: "door" }, icon: <DoorOpen className="size-4" /> },
  { key: "driver", label: "Driver", cell: { kind: "driver" }, icon: <SteeringWheel className="size-4" /> },
];

const SEAT_STYLE: Record<SeatGender, string> = {
  female: "border-female bg-female-lt text-female",
  male: "border-male bg-male-lt text-male",
  any: "border-slate-300 bg-white text-slate-700",
};

function resize(layout: Layout, rows: number, cols: number): Layout {
  const next = emptyLayout(rows, cols);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (layout.cells[r]?.[c]) next.cells[r][c] = layout.cells[r][c];
  return next;
}

export function LayoutEditor({
  initial,
  booked = {},
  presets = [],
  name: initialName,
  onSave,
}: {
  initial: Layout;
  /** Seats with passengers (trip seating): they can't be removed or given to the other gender. */
  booked?: Record<string, Gender>;
  /** Saved vehicles to start over from. */
  presets?: { name: string; layout: Layout }[];
  /** Shown as an editable name field when set (vehicles). */
  name?: string;
  onSave: (layoutJson: string, name: string) => Promise<FormState>;
}) {
  const [layout, setLayout] = useState(initial);
  const [name, setName] = useState(initialName ?? "");
  const [tool, setTool] = useState<Tool>(TOOLS[0]);
  /** Price the fare tool applies; empty clears a seat's own price so it uses the trip fare. */
  const [fareInput, setFareInput] = useState("");
  const [message, setMessage] = useState<FormState>();
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const painting = useRef(false);

  const seats = useMemo(() => seatList(layout), [layout]);
  const labels = new Map(seats.map((s) => [s.id, s.label]));
  const clashes = useMemo(() => genderClashes(layout), [layout]);
  const counts = { female: 0, male: 0, any: 0 };
  seats.forEach((s) => counts[s.gender]++);

  const change = (next: Layout) => {
    setLayout(next);
    setDirty(true);
    setMessage(undefined);
  };

  const allowed = (id: string, cell: Cell) => {
    const who = booked[id];
    return !who || (cell.kind === "seat" && (cell.gender === "any" || cell.gender === who));
  };

  const paint = (r: number, c: number) => {
    const id = seatId(r, c);
    if (tool.key === FARE_TOOL.key) {
      const fare = fareInput.trim() === "" ? undefined : Number(fareInput);
      if (fare !== undefined && (!Number.isInteger(fare) || fare < 0 || fare > MAX_FARE)) {
        setMessage({ error: "Enter the seat price in whole rupees." });
        return;
      }
      setLayout((prev) => {
        const cur = prev.cells[r][c];
        if (cur.kind !== "seat" || cur.fare === fare) return prev;
        const cells = prev.cells.map((row) => [...row]);
        const { fare: _old, ...rest } = cur; // eslint-disable-line @typescript-eslint/no-unused-vars
        cells[r][c] = fare === undefined ? rest : { ...rest, fare };
        return { ...prev, cells };
      });
      setDirty(true);
      setMessage(undefined);
      return;
    }
    if (!allowed(id, tool.cell)) {
      setMessage({ error: `Seat ${labels.get(id)} has a ${booked[id]} passenger, so it can only be a ${booked[id]} or open seat.` });
      return;
    }
    // Functional update: a fast drag paints several cells before the next render.
    setLayout((prev) => {
      const cur = prev.cells[r][c];
      if (cur.kind === tool.cell.kind && cur.gender === tool.cell.gender) return prev;
      const cells = prev.cells.map((row) => [...row]);
      // A seat keeps its own price when only its gender changes.
      cells[r][c] = tool.cell.kind === "seat" && cur.kind === "seat" && cur.fare !== undefined ? { ...tool.cell, fare: cur.fare } : { ...tool.cell };
      return { ...prev, cells };
    });
    setDirty(true);
    setMessage(undefined);
  };

  const setAll = (gender: SeatGender) =>
    change({
      ...layout,
      cells: layout.cells.map((row, r) =>
        row.map((cell, c) => (cell.kind === "seat" && allowed(seatId(r, c), { kind: "seat", gender }) ? { ...cell, gender } : cell)),
      ),
    });

  const bookedOutside = (rows: number, cols: number) =>
    Object.keys(booked).some((id) => {
      const [r, c] = id.split("-").map(Number);
      return r >= rows || c >= cols;
    });

  const setSize = (rows: number, cols: number) => {
    if (rows < 1 || cols < 1 || rows > MAX_ROWS || cols > MAX_COLS) return;
    if (bookedOutside(rows, cols)) {
      setMessage({ error: "That would remove a booked seat." });
      return;
    }
    change(resize(layout, rows, cols));
  };

  const save = () =>
    startTransition(async () => {
      const res = await onSave(JSON.stringify(layout), name);
      setMessage(res);
      if (!res?.error) setDirty(false);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="card select-none" onPointerUp={() => (painting.current = false)} onPointerLeave={() => (painting.current = false)}>
        <p className="mb-4 text-center text-sm text-slate-500">Choose a tool, then tap or drag over the grid.</p>
        <div className="touch-none">
          <VehicleFrame cols={layout.cols}>
            {layout.cells.flatMap((row, r) =>
              row.map((cell, c) => {
                const id = seatId(r, c);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={cell.kind === "seat" ? `Seat ${labels.get(id)} (${cell.gender})` : cell.kind}
                    onPointerDown={(e) => {
                      // Touch captures the pointer on the first cell; release it so dragging reaches the others.
                      const el = e.target as Element;
                      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
                      painting.current = true;
                      paint(r, c);
                    }}
                    onPointerEnter={() => painting.current && paint(r, c)}
                    className="relative size-12 rounded-xl outline-offset-2 hover:outline-2 hover:outline-brand/50 sm:size-14"
                  >
                    {cell.kind === "seat" ? (
                      <span
                        className={`flex size-full flex-col items-center justify-center rounded-t-2xl rounded-b-lg border-2 text-sm font-bold ${SEAT_STYLE[cell.gender ?? "any"]}`}
                      >
                        <span className="flex items-center gap-0.5">
                          {labels.get(id)}
                          {booked[id] && <Lock className="size-3" />}
                        </span>
                        {cell.fare !== undefined && <span className="text-[9px] font-semibold leading-none text-emerald-700">Rs{cell.fare}</span>}
                      </span>
                    ) : cell.kind === "empty" ? (
                      <span className="block size-full rounded-xl border border-dashed border-slate-200" />
                    ) : (
                      <FixtureCell cell={cell} />
                    )}
                  </button>
                );
              }),
            )}
          </VehicleFrame>
        </div>
      </div>

      <div className="space-y-4">
        {initialName !== undefined && (
          <div className="card">
            <label className="label" htmlFor="vehicle-name">
              Vehicle name
            </label>
            <input id="vehicle-name" className="input" value={name} onChange={(e) => (setName(e.target.value), setDirty(true))} placeholder="e.g. Hiace LEA-1234" />
          </div>
        )}

        <div className="card">
          <h3 className="mb-2 text-sm font-semibold">Tool</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {[...TOOLS, FARE_TOOL].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTool(t)}
                aria-pressed={tool.key === t.key}
                className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left text-xs font-medium ${
                  tool.key === t.key ? "border-brand bg-brand-lt/40" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          {tool.key === FARE_TOOL.key && (
            <div className="mt-3 rounded-lg bg-emerald-50 p-2.5">
              <label className="label !text-xs" htmlFor="seat-fare">
                Price for the seats you tap (Rs.)
              </label>
              <input
                id="seat-fare"
                type="number"
                inputMode="numeric"
                min={0}
                className="input"
                value={fareInput}
                onChange={(e) => setFareInput(e.target.value)}
                placeholder="Empty = trip fare"
              />
              <p className="mt-1 text-[11px] text-emerald-900">Leave it empty and tap a seat to remove its own price, so it uses the trip&apos;s fare.</p>
            </div>
          )}
          <h3 className="mb-2 mt-4 text-sm font-semibold">All seats</h3>
          <div className="flex gap-1.5">
            <button type="button" className="btn-ghost flex-1 !px-2 !py-1.5 text-xs" onClick={() => setAll("female")}>
              Female
            </button>
            <button type="button" className="btn-ghost flex-1 !px-2 !py-1.5 text-xs" onClick={() => setAll("male")}>
              Male
            </button>
            <button type="button" className="btn-ghost flex-1 !px-2 !py-1.5 text-xs" onClick={() => setAll("any")}>
              Anyone
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-2 text-sm font-semibold">Grid size</h3>
          <Stepper label="Rows" value={layout.rows} onChange={(v) => setSize(v, layout.cols)} max={MAX_ROWS} />
          <Stepper label="Columns" value={layout.cols} onChange={(v) => setSize(layout.rows, v)} max={MAX_COLS} />
          {presets.length > 0 && (
            <select
              className="input mt-3"
              value=""
              onChange={(e) => {
                const p = presets[Number(e.target.value)];
                if (!p) return;
                if (Object.keys(booked).length) {
                  setMessage({ error: "This trip has bookings, so its seating can't be replaced. Edit it seat by seat instead." });
                  return;
                }
                if (confirm(`Replace this seating with "${p.name}"?`)) change(structuredClone(p.layout));
              }}
            >
              <option value="">Start from a saved vehicle…</option>
              {presets.map((p, i) => (
                <option key={i} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="card text-sm">
          <div className="mb-1 font-semibold">{seats.length} seats</div>
          <div className="flex gap-3 text-slate-600">
            <span className="text-female">{counts.female} female</span>
            <span className="text-male">{counts.male} male</span>
            <span>{counts.any} anyone</span>
          </div>
          {clashes.length > 0 && (
            <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              <TriangleAlert className="size-4 shrink-0" />
              <span>
                {clashes.map(([a, b]) => `${a.label} & ${b.label}`).join(", ")}: female and male seats side by side. Only one seat of each pair can be filled. Put an aisle between them, or make one of them the same gender.
              </span>
            </div>
          )}
          {Object.keys(booked).length > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="size-3" /> Booked seats stay in place.
            </p>
          )}
        </div>

        {message?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message.error}</p>}
        {message?.ok && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message.ok}</p>}
        <button type="button" className="btn-primary w-full" onClick={save} disabled={pending || !dirty}>
          {pending ? "Saving…" : dirty ? "Save seating" : "Saved"}
        </button>
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost !p-1.5" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="size-4" />
        </button>
        <span className="w-6 text-center font-semibold">{value}</span>
        <button type="button" className="btn-ghost !p-1.5" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}
