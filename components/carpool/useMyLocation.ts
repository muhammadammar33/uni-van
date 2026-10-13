"use client";

import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

export type LocationStatus = "unknown" | "prompt" | "asking" | "granted" | "denied" | "unsupported";

/**
 * The visitor's location, if they allow it. Doesn't ask on its own: call `request()` from a button
 * (browsers only show the permission prompt reliably after a tap). Once granted, later visits get it silently.
 */
export function useMyLocation() {
  const [status, setStatus] = useState<LocationStatus>("unknown");
  const [pos, setPos] = useState<LatLng | null>(null);

  const read = useCallback(
    () =>
      new Promise<LatLng | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setStatus("unsupported");
          return resolve(null);
        }
        setStatus("asking");
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const here = { lat: p.coords.latitude, lng: p.coords.longitude };
            setPos(here);
            setStatus("granted");
            resolve(here);
          },
          (err) => {
            setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "prompt");
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
        );
      }),
    [],
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after hydration
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((p) => {
        if (cancelled) return;
        if (p.state === "granted") read();
        else setStatus(p.state === "denied" ? "denied" : "prompt");
      })
      .catch(() => !cancelled && setStatus("prompt"));
    return () => {
      cancelled = true;
    };
  }, [read]);

  return { status, pos, request: read };
}

/** A random id this browser keeps, for sharing a live position without an account. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem("hamsafar:device");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
      localStorage.setItem("hamsafar:device", id);
    }
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 10);
  }
}
