"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LocateFixed, Radio } from "lucide-react";
import { MapView, type MapMarker } from "@/components/carpool/MapView";
import { deviceId, useMyLocation } from "@/components/carpool/useMyLocation";
import type { LivePosition } from "@/lib/rides";

const POLL_MS = 15_000;

/**
 * Everyone sharing their location right now: drivers on their way (with their ride) and riders waiting
 * (shown roughly, without a name). Visitors can allow location to see themselves, and choose to appear too.
 */
export function LiveMap() {
  const loc = useMyLocation();
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [sharing, setSharing] = useState(false);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      if (res.ok) setPositions((await res.json()).positions);
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load of live data
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const send = useCallback((lat: number, lng: number) => {
    if (Date.now() - lastSent.current < 10_000) return;
    lastSent.current = Date.now();
    fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: deviceId(), role: "rider", lat, lng }) }).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
    fetch("/api/live", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: deviceId() }) }).catch(() => {});
  }, []);

  const start = async () => {
    const here = loc.pos ?? (await loc.request());
    if (!here) return;
    setSharing(true);
    lastSent.current = 0;
    send(here.lat, here.lng);
    watch.current = navigator.geolocation.watchPosition((p) => send(p.coords.latitude, p.coords.longitude), undefined, { enableHighAccuracy: true, maximumAge: 15000 });
    setTimeout(load, 800);
  };

  useEffect(() => () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
  }, []);

  const drivers = positions.filter((p) => p.role === "driver");
  const riders = positions.filter((p) => p.role === "rider");
  const markers: MapMarker[] = [
    ...riders.map((p) => ({ lat: p.lat, lng: p.lng, kind: "rider" as const })),
    ...drivers.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      kind: "driver" as const,
      label: p.label ?? "Driver",
      popup: p.ride ? { title: p.label ?? "Driver", lines: [`${p.ride.from} → ${p.ride.to}`], link: { href: `/r/${p.ride.slug}`, text: "See the ride" } } : undefined,
    })),
    ...(loc.pos ? [{ ...loc.pos, kind: "me" as const }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="flex items-center gap-2 font-semibold text-emerald-700">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="grid size-5 place-items-center rounded-full bg-brand text-[10px]">🚗</span> {drivers.length} driver{drivers.length === 1 ? "" : "s"} on the road
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="size-3 rounded-full border-2 border-white bg-amber-500 shadow" /> {riders.length} rider{riders.length === 1 ? "" : "s"} looking
        </span>
      </div>
      <MapView className="h-80 sm:h-[26rem]" markers={markers} fitKey={loc.pos ? "me" : positions.length ? "live" : "region"} center={loc.pos} />
      <div className="flex flex-wrap gap-2">
        {loc.status !== "granted" && (
          <button type="button" className="btn-primary" onClick={loc.request} disabled={loc.status === "asking" || loc.status === "unsupported"}>
            <LocateFixed className="size-4" /> {loc.status === "asking" ? "Finding you…" : loc.status === "denied" ? "Location blocked in browser settings" : "Show where I am"}
          </button>
        )}
        {sharing ? (
          <button type="button" className="btn-ghost" onClick={stop}>
            <EyeOff className="size-4" /> Stop showing me
          </button>
        ) : (
          <button type="button" className="btn-ghost" onClick={start} disabled={loc.status === "denied" || loc.status === "unsupported"}>
            <Eye className="size-4" /> Show me on the live map
          </button>
        )}
        {sharing && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Radio className="size-3.5 text-emerald-600" /> Others see you roughly (about 300 m), without your name, while this page is open.
          </span>
        )}
      </div>
    </div>
  );
}
