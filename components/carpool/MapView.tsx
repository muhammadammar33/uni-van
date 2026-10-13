"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { REGION_CENTER } from "@/lib/places";
import type { LatLng } from "@/lib/geo";

export type MapRoute = { points: (LatLng & { name: string })[]; color?: string; highlight?: [number, number] };
/** Popup text is always escaped: names and places come from users. */
export type MapMarker = LatLng & { kind: "driver" | "rider" | "me" | "pin"; label?: string; popup?: { title: string; lines?: string[]; link?: { href: string; text: string } } };

const ICON_HTML: Record<MapMarker["kind"], (label?: string) => string> = {
  driver: (l) =>
    `<div class="hm-pin hm-driver"><span>🚗</span>${l ? `<b>${escapeHtml(l)}</b>` : ""}</div>`,
  rider: () => `<div class="hm-dot hm-rider"></div>`,
  me: () => `<div class="hm-me"><i></i></div>`,
  pin: () => `<div class="hm-pin hm-drop"><span>📍</span></div>`,
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * OpenStreetMap map (via Leaflet) showing routes, live positions and the visitor. With `onPick`, a tap drops a pin.
 * Only fits the view to its content the first time (and when `fitKey` changes), so live updates don't jump around.
 */
export function MapView({
  routes = [],
  markers = [],
  onPick,
  className = "h-72",
  fitKey,
  center,
}: {
  routes?: MapRoute[];
  markers?: MapMarker[];
  onPick?: (p: LatLng) => void;
  className?: string;
  /** Change this to re-fit the view to the current content. */
  fitKey?: string;
  center?: LatLng | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const fitted = useRef<string | undefined>(undefined);
  const pick = useRef(onPick);
  pick.current = onPick;

  // Create the map once.
  useEffect(() => {
    let disposed = false;
    import("leaflet").then((mod) => {
      if (disposed || !box.current || map.current) return;
      const leaflet = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = leaflet;
      const m = leaflet.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: !!pick.current }).setView([REGION_CENTER.lat, REGION_CENTER.lng], 11);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => pick.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      map.current = m;
      draw();
    });
    return () => {
      disposed = true;
      // Stop any pan/zoom animation first, or Leaflet throws (_leaflet_pos) when it finishes on a removed map.
      map.current?.stop();
      map.current?.off();
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; draw() runs on prop changes below
  }, []);

  function draw() {
    const leaflet = L.current;
    const m = map.current;
    const g = layer.current;
    if (!leaflet || !m || !g) return;
    g.clearLayers();
    const bounds: [number, number][] = [];
    for (const r of routes) {
      if (!r.points.length) continue;
      const latlngs = r.points.map((p) => [p.lat, p.lng] as [number, number]);
      leaflet.polyline(latlngs, { color: r.color ?? "#0f766e", weight: 5, opacity: 0.55, dashArray: "1 10", lineCap: "round" }).addTo(g);
      if (r.highlight) {
        const [a, b] = r.highlight;
        leaflet.polyline(latlngs.slice(a, b + 1), { color: r.color ?? "#0f766e", weight: 6, opacity: 0.95 }).addTo(g);
      }
      r.points.forEach((p, i) => {
        const end = i === 0 || i === r.points.length - 1;
        const on = r.highlight && (i === r.highlight[0] || i === r.highlight[1]);
        leaflet
          .circleMarker([p.lat, p.lng], {
            radius: end || on ? 8 : 5,
            color: "#fff",
            weight: 2,
            fillColor: on ? "#f59e0b" : i === 0 ? "#0f766e" : i === r.points.length - 1 ? "#134e4a" : "#14b8a6",
            fillOpacity: 1,
          })
          .bindTooltip(escapeHtml(p.name), { direction: "top", offset: [0, -6] })
          .addTo(g);
        bounds.push([p.lat, p.lng]);
      });
    }
    for (const mk of markers) {
      const icon = leaflet.divIcon({ html: ICON_HTML[mk.kind](mk.label), className: "", iconSize: [0, 0] });
      const marker = leaflet.marker([mk.lat, mk.lng], { icon, zIndexOffset: mk.kind === "me" ? 1000 : mk.kind === "driver" ? 500 : 0 }).addTo(g);
      if (mk.popup) {
        const { title, lines = [], link } = mk.popup;
        const href = link && /^\/[A-Za-z0-9/_?=&.-]*$/.test(link.href) ? link.href : null;
        marker.bindPopup(
          `<b>${escapeHtml(title)}</b>${lines.map((l) => `<br>${escapeHtml(l)}`).join("")}${href ? `<br><a href="${href}">${escapeHtml(link!.text)}</a>` : ""}`,
        );
      }
      bounds.push([mk.lat, mk.lng]);
    }
    if (center) bounds.push([center.lat, center.lng]);
    const key = fitKey ?? "default";
    if (fitted.current !== key && bounds.length) {
      fitted.current = key;
      if (bounds.length === 1) m.setView(bounds[0], 14, { animate: false });
      else m.fitBounds(bounds, { padding: [30, 30], maxZoom: 15, animate: false });
    }
  }

  // Redraw on every change of content.
  useEffect(draw);

  return <div ref={box} className={`relative z-0 w-full overflow-hidden rounded-2xl bg-slate-100 ${className}`} />;
}
