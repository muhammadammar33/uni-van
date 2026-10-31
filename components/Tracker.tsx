"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Counts page views for the owner's analytics (a background ping; nothing about the person is sent). */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith("/admin")) return;
    try {
      if (!navigator.sendBeacon?.("/api/track", path)) fetch("/api/track", { method: "POST", body: path, keepalive: true }).catch(() => {});
    } catch {}
  }, [path]);
  return null;
}
