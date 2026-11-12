"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Phone, ShieldAlert, Siren, X } from "lucide-react";

type Where = { lat: number; lng: number } | null;

function locate(): Promise<Where> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  });
}

/**
 * SOS for riders and drivers during a trip: call the police (15) or Rescue 1122 in one tap, send family the
 * trip and where you are on WhatsApp, and alert the Hamsafar team with the ride and your location.
 * `trip`: a few lines about the trip (driver, car, plate, route) for the family message and the report.
 */
export function SosButton({ slug, role, trip, compact = false }: { slug: string; role: "rider" | "driver"; trip: string[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<"" | "sending" | "sent" | "failed">("");

  const mapLink = (w: Where) => (w ? `https://maps.google.com/?q=${w.lat.toFixed(6)},${w.lng.toFixed(6)}` : null);

  async function tellFamily() {
    const w = await locate();
    const text = ["🚨 I need help. I'm on a Hamsafar ride.", ...trip, mapLink(w) ? `Where I am now: ${mapLink(w)}` : "", `Ride page: ${window.location.origin}/r/${slug}`]
      .filter(Boolean)
      .join("\n");
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function alertTeam() {
    setSent("sending");
    const w = await locate();
    const message = [`SOS from the ${role} on ride /r/${slug}.`, ...trip, mapLink(w) ? `Location: ${mapLink(w)}` : "Location: not shared"].join("\n");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "safety", role, message, page: `/r/${slug}#sos`, ride: slug }),
    }).catch(() => null);
    setSent(res?.ok ? "sent" : "failed");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 ${compact ? "" : "mt-2 w-full"}`}
        aria-haspopup="dialog"
      >
        <Siren className="size-4" /> SOS · Emergency help
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Emergency help" onClick={() => setOpen(false)}>
            <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-red-100 text-red-700">
                  <Siren className="size-6" />
                </span>
                <h2 className="flex-1 text-lg font-extrabold">Emergency help</h2>
                <button type="button" className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close" onClick={() => setOpen(false)}>
                  <X className="size-5" />
                </button>
              </div>
              <p className="text-sm text-slate-600">If you are in danger, call now. Then tell your family and us.</p>
              <div className="grid grid-cols-2 gap-2">
                <a href="tel:15" className="btn bg-red-600 py-3 text-white hover:bg-red-700">
                  <Phone className="size-4" /> Police 15
                </a>
                <a href="tel:1122" className="btn bg-red-600 py-3 text-white hover:bg-red-700">
                  <Phone className="size-4" /> Rescue 1122
                </a>
              </div>
              <button type="button" onClick={tellFamily} className="btn w-full bg-[#25D366] py-3 text-white hover:bg-[#1ebe5b]">
                <MapPin className="size-4" /> Send my location to family
              </button>
              <button type="button" onClick={alertTeam} disabled={sent === "sending" || sent === "sent"} className="btn-ghost w-full py-3">
                <ShieldAlert className="size-4" />
                {sent === "sent" ? "Hamsafar team alerted" : sent === "sending" ? "Alerting…" : "Alert the Hamsafar team"}
              </button>
              {sent === "failed" && <p className="text-sm text-red-600">Couldn’t reach Hamsafar. Call 15 or 1122 if you are in danger.</p>}
              <p className="text-xs text-slate-500">Your location is only shared when you tap a button here, and only with the people you send it to.</p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
