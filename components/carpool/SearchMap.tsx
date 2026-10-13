"use client";

import { MapView, type MapRoute } from "@/components/carpool/MapView";
import type { Point } from "@/lib/places";

const COLORS = ["#0f766e", "#7c3aed", "#db2777", "#2563eb", "#ea580c", "#16a34a", "#0891b2", "#9333ea"];

/** The searched pickup / drop-off and the matching rides' routes (the rider's part drawn solid). */
export function SearchMap({ from, to, routes }: { from: Point | null; to: Point | null; routes: MapRoute[] }) {
  return (
    <MapView
      className="h-64"
      routes={routes.map((r, i) => ({ ...r, color: COLORS[i % COLORS.length] }))}
      markers={[...(from ? [{ ...from, kind: "pin" as const }] : []), ...(to ? [{ ...to, kind: "pin" as const }] : [])]}
      fitKey={`${from?.lat},${to?.lat},${routes.length}`}
    />
  );
}
