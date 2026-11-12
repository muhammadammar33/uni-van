"use client";

import { useEffect, useRef } from "react";

/** No touch, key, scroll or mouse movement for this long: the page is just left open, so check less often. */
const IDLE_AFTER_MS = 3 * 60_000;
const IDLE_FACTOR = 4;

/**
 * Calls `refresh` every `everyMs` while the page is visible. When the tab or app comes back into view it
 * refreshes at once; while hidden it doesn't run at all; on a page nobody is touching it slows down 4×.
 * Every refresh is a request to the server, so this keeps open pages cheap (and within free hosting limits).
 * `enabled: false` stops it (e.g. nothing left to wait for).
 */
export function useAutoRefresh(refresh: () => unknown, everyMs: number, enabled = true) {
  const fn = useRef(refresh);
  useEffect(() => {
    fn.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    let lastActive = Date.now();
    let lastRun = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const active = () => (lastActive = Date.now());
    const run = () => {
      lastRun = Date.now();
      void fn.current();
    };
    const schedule = () => {
      const idle = Date.now() - lastActive > IDLE_AFTER_MS;
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") run();
        schedule();
      }, idle ? everyMs * IDLE_FACTOR : everyMs);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      active();
      // Back on the page after a while: fresh data now rather than at the next tick.
      if (Date.now() - lastRun > Math.min(everyMs, 10_000)) run();
    };
    const events = ["pointerdown", "keydown", "scroll", "mousemove", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    schedule();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, active));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [everyMs, enabled]);
}
