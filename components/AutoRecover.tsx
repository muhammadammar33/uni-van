"use client";

import { useEffect, useState } from "react";

const KEY = "hamsafar:auto-reload";

/**
 * Shown when a page fails to load in the browser. The usual cause is a new version of the site going live while
 * the page was open (the old page asks for files that are gone): one reload fixes it, so it reloads by itself,
 * at most once a minute. If that doesn't help, it shows a Reload button instead of looping.
 */
export function AutoRecover({ reset }: { reset?: () => void }) {
  const [manual, setManual] = useState(false);
  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {}
    if (Date.now() - last > 60_000) {
      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {}
      window.location.reload();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once, after the reload check
      setManual(true);
    }
  }, []);
  return (
    <div className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div className="space-y-3">
        <p className="text-lg font-bold">{manual ? "This page couldn't load" : "Loading the latest version…"}</p>
        {manual && (
          <div className="flex justify-center gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
            {reset && (
              <button className="btn-ghost" onClick={() => reset()}>
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
