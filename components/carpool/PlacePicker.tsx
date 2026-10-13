"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Crosshair, LocateFixed, Map as MapIcon, MapPin, Search, X } from "lucide-react";
import { MapView } from "@/components/carpool/MapView";
import { useMyLocation } from "@/components/carpool/useMyLocation";
import { distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { AREAS, PLACES, type Point } from "@/lib/places";

/** Best-effort street name for a pin, from OpenStreetMap (Nominatim). */
async function reverseName(p: LatLng): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=en&lat=${p.lat}&lon=${p.lng}`);
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const parts = [a.road ?? a.neighbourhood ?? a.suburb, a.suburb && a.road ? a.suburb : null, a.city ?? a.town ?? a.village].filter(Boolean);
    return [...new Set(parts)].slice(0, 2).join(", ") || j.display_name?.split(",").slice(0, 2).join(",") || null;
  } catch {
    return null;
  }
}

/**
 * Pick a location: search the list of common places from Wah Cantt to Rawat, use the current location,
 * or drop a pin on the map.
 */
export function PlacePicker({
  label,
  value,
  onChange,
  placeholder = "Choose a location",
  icon = "start",
}: {
  label: string;
  value: Point | null;
  onChange: (p: Point | null) => void;
  placeholder?: string;
  icon?: "start" | "end" | "stop";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "map">("list");
  const [q, setQ] = useState("");
  const loc = useMyLocation();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && mode === "list") setTimeout(() => input.current?.focus(), 50);
  }, [open, mode]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const hits = term ? PLACES.filter((p) => `${p.name} ${p.area} ${p.key}`.toLowerCase().includes(term)) : PLACES;
    if (loc.pos && !term) {
      // Closest first when we know where the visitor is.
      return [{ area: "Near you", places: [...PLACES].sort((a, b) => distanceKm(a, loc.pos!) - distanceKm(b, loc.pos!)).slice(0, 4) }, ...AREAS.map((a) => ({ area: a, places: hits.filter((p) => p.area === a) }))];
    }
    return AREAS.map((a) => ({ area: a, places: hits.filter((p) => p.area === a) })).filter((g) => g.places.length);
  }, [q, loc.pos]);

  const choose = (p: Point) => {
    onChange(p);
    setOpen(false);
    setMode("list");
    setQ("");
  };

  const useHere = async () => {
    const here = loc.pos ?? (await loc.request());
    if (!here) return;
    const name = (await reverseName(here)) ?? "My location";
    choose({ name: `${name}`, lat: here.lat, lng: here.lng });
  };

  const dot = icon === "start" ? "bg-brand" : icon === "end" ? "bg-ink" : "bg-teal-400";

  return (
    <div>
      <span className="label">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input flex items-center gap-2.5 text-left"
        aria-haspopup="dialog"
        aria-label={`${label}: ${value?.name ?? placeholder}`}
      >
        <span className={`size-2.5 shrink-0 rounded-full ${dot}`} />
        <span className={`min-w-0 flex-1 truncate ${value ? "font-medium text-ink" : "text-slate-400"}`}>{value?.name ?? placeholder}</span>
        {value && !value.key && <MapPin className="size-4 shrink-0 text-amber-600" aria-label="Pinned on map" />}
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label={label}
            className="flex max-h-[92dvh] w-full max-w-lg animate-rise flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 p-3">
              <div className="flex flex-1 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
                <button type="button" onClick={() => setMode("list")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 ${mode === "list" ? "bg-white shadow-sm" : "text-slate-500"}`}>
                  <Search className="size-4" /> Search places
                </button>
                <button type="button" onClick={() => setMode("map")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 ${mode === "map" ? "bg-white shadow-sm" : "text-slate-500"}`}>
                  <MapIcon className="size-4" /> Pick on map
                </button>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            {mode === "list" ? (
              <>
                <div className="space-y-2 p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: G-9, Saddar, Taxila, Bahria…" className="input !pl-9" aria-label="Search places" />
                  </div>
                  <button type="button" onClick={useHere} className="flex w-full items-center gap-3 rounded-xl bg-blue-50 px-3 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100">
                    <LocateFixed className="size-5" />
                    {loc.status === "asking" ? "Finding you…" : loc.status === "denied" ? "Location is blocked: allow it in your browser settings" : "Use my current location"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-4">
                  {list.map((g) => (
                    <div key={g.area} className="mb-2">
                      <div className="sticky top-0 bg-white py-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{g.area}</div>
                      {g.places.map((p) => (
                        <button
                          key={g.area + p.key}
                          type="button"
                          onClick={() => choose({ key: p.key, name: p.name, lat: p.lat, lng: p.lng })}
                          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50 ${value?.key === p.key ? "bg-brand-lt/50" : ""}`}
                        >
                          <MapPin className="size-4 shrink-0 text-slate-400" />
                          <span className="flex-1 text-sm font-medium">{p.name}</span>
                          {loc.pos && <span className="text-xs text-slate-400">{formatKm(distanceKm(p, loc.pos))}</span>}
                          {value?.key === p.key && <Check className="size-4 text-brand" />}
                        </button>
                      ))}
                    </div>
                  ))}
                  {list.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Not in the list.{" "}
                      <button type="button" className="font-semibold text-brand underline" onClick={() => setMode("map")}>
                        Pick it on the map
                      </button>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <MapPick initial={value} me={loc.pos} onLocate={loc.request} onDone={choose} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MapPick({ initial, me, onLocate, onDone }: { initial: Point | null; me: LatLng | null; onLocate: () => Promise<LatLng | null>; onDone: (p: Point) => void }) {
  const [pin, setPin] = useState<LatLng | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [name, setName] = useState(initial && !initial.key ? initial.name : "");
  const [busy, setBusy] = useState(false);
  const [fit, setFit] = useState("first");

  const place = async (p: LatLng) => {
    setPin(p);
    setBusy(true);
    const n = await reverseName(p);
    setBusy(false);
    if (n) setName(n);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
      <p className="text-sm text-slate-600">Tap the map to drop a pin exactly where you are picked up or dropped off. Zoom in for streets.</p>
      <MapView
        className="h-[46dvh] sm:h-80"
        markers={[...(me ? [{ ...me, kind: "me" as const }] : []), ...(pin ? [{ ...pin, kind: "pin" as const }] : [])]}
        onPick={place}
        fitKey={fit}
        center={pin ?? me}
      />
      <button
        type="button"
        className="btn-ghost"
        onClick={async () => {
          const here = me ?? (await onLocate());
          if (here) {
            await place(here);
            setFit(`me-${Date.now()}`);
          }
        }}
      >
        <Crosshair className="size-4" /> Drop the pin where I am
      </button>
      <div>
        <label className="label" htmlFor="pin-name">
          Name for this place
        </label>
        <input id="pin-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={busy ? "Looking up the street…" : "e.g. Street 12, G-11/2"} maxLength={80} />
      </div>
      <button type="button" className="btn-primary py-3" disabled={!pin || name.trim().length < 2} onClick={() => pin && onDone({ name: name.trim(), lat: pin.lat, lng: pin.lng })}>
        Use this place
      </button>
    </div>
  );
}
