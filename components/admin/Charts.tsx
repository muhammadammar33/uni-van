"use client";

import { useState } from "react";

/**
 * Small charts for the owner's analytics. One series each, one hue (teal-600, checked against the white card),
 * thin marks, hairline grid, a hover readout, and a table view so nothing depends on hovering.
 */
const MARK = "#0d9488";
const GRID = "#e2e8f0";

const compact = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}K` : v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(v));
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Clean axis steps: 0 and up to 3 round values covering the top. */
function ticks(max: number) {
  if (max <= 0) return [0, 1];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Daily columns (e.g. visitors per day), with a hover readout and a table view. */
export function DailyColumns({ title, unit, data }: { title: string; unit: string; data: { day: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at about phone width, so labels stay readable when it scales.
  const W = 360;
  const H = 150;
  const pad = { l: 36, r: 8, t: 10, b: 24 };
  const ys = ticks(Math.max(0, ...data.map((d) => d.value)));
  const top = ys[ys.length - 1] || 1;
  const slot = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const total = data.reduce((n, d) => n + d.value, 0);
  const h = hover !== null ? data[hover] : null;
  return (
    <figure className="card min-w-0 !p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-slate-500">
          {h ? (
            <>
              <b className="text-ink">{h.value.toLocaleString()}</b> {unit} · {dayLabel(h.day)}
            </>
          ) : (
            <>
              <b className="text-ink">{total.toLocaleString()}</b> in total
            </>
          )}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${title}: ${total} ${unit} in total`} onPointerLeave={() => setHover(null)}>
        {ys.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#64748b" style={{ fontVariantNumeric: "tabular-nums" }}>
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          const yy = y(d.value);
          const hh = y(0) - yy;
          const r = Math.min(4, bw / 2, hh);
          return (
            <g key={d.day} onPointerEnter={() => setHover(i)}>
              {/* The whole column slot is the hover target, not just the bar. */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {d.value > 0 && (
                <path
                  d={`M${x},${y(0)} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${y(0)} Z`}
                  fill={MARK}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
            </g>
          );
        })}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) =>
          data[i] ? (
            <text key={i} x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize={11} fill="#64748b">
              {dayLabel(data[i].day)}
            </text>
          ) : null,
        )}
      </svg>
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-xs text-slate-500">Show as table</summary>
        <table className="mt-2 w-full text-left text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
          <tbody>
            {data
              .filter((d) => d.value > 0)
              .map((d) => (
                <tr key={d.day} className="border-t border-slate-100">
                  <td className="py-1">{dayLabel(d.day)}</td>
                  <td className="py-1 text-right">{d.value.toLocaleString()}</td>
                </tr>
              ))}
            {data.every((d) => d.value === 0) && (
              <tr>
                <td className="py-1 text-slate-500">Nothing yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Ranked horizontal bars, largest first (top routes, searches, pages). Labels and values in text colours. */
export function RankedBars({ title, note, unit, items, empty }: { title: string; note?: string; unit: string; items: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <section className="card min-w-0 !p-4">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-xs text-slate-500">{note}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {items.map((it) => (
            <li key={it.label} className="min-w-0" title={`${it.label}: ${it.value} ${unit}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{it.label}</span>
                <span className="shrink-0 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {it.value.toLocaleString()}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: MARK }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
