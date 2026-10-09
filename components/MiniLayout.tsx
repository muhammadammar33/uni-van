import type { Layout } from "@/lib/layout";

const SEAT = { female: "bg-female/70", male: "bg-male/70", any: "bg-slate-300" } as const;

/** Thumbnail of a seating plan: coloured dots for seats, dark for the driver. */
export function MiniLayout({ layout }: { layout: Layout }) {
  return (
    <div className="rounded-xl rounded-t-2xl border-2 border-slate-200 bg-white p-1.5">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${layout.cols}, 0.6rem)` }}>
        {layout.cells.flatMap((row, r) =>
          row.map((cell, c) => (
            <span
              key={`${r}-${c}`}
              className={`size-2.5 rounded-[3px] ${
                cell.kind === "seat" ? SEAT[cell.gender ?? "any"] : cell.kind === "driver" ? "bg-slate-800" : "bg-transparent"
              }`}
            />
          )),
        )}
      </div>
    </div>
  );
}
