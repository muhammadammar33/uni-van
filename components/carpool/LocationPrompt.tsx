"use client";

import { useEffect, useState } from "react";
import { LocateFixed, X } from "lucide-react";
import { useMyLocation } from "@/components/carpool/useMyLocation";

const DISMISSED = "hamsafar:location-prompt";

/** Asks once for location access, explaining what it's for. */
export function LocationPrompt() {
  const loc = useMyLocation();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after hydration
      setHidden(localStorage.getItem(DISMISSED) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden || loc.status !== "prompt") return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {}
  };
  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md animate-rise rounded-2xl bg-ink p-4 text-white shadow-2xl sm:bottom-5">
      <button onClick={dismiss} className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-white" aria-label="Not now">
        <X className="size-4" />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-blue-300">
          <LocateFixed className="size-5" />
        </span>
        <div>
          <p className="font-bold">Allow your location for a better experience</p>
          <p className="mt-0.5 text-sm text-slate-300">We use it to suggest the nearest pickup point and show rides near you on the map. Nothing is shared unless you choose to.</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          className="btn-accent flex-1"
          onClick={async () => {
            await loc.request();
            dismiss();
          }}
        >
          Allow location
        </button>
        <button className="btn flex-1 text-slate-300 ring-1 ring-white/20 hover:bg-white/10" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
