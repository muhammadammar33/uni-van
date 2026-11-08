"use client";

import { useEffect } from "react";
import { appLinkTarget, appPlatform, inApp, plugin } from "@/lib/nativeApp";

/**
 * Inside the Hamsafar app: marks the page (so styles can adapt), and follows links the app is opened with
 * (Google sign-in coming back, shared ride links). Does nothing on the website.
 */
export function AppBridge() {
  useEffect(() => {
    if (!inApp()) return;
    document.documentElement.dataset.app = appPlatform() ?? "app";
    const app = plugin("App");
    let handle: { remove?: () => void } | undefined;
    Promise.resolve(
      app?.addListener?.("appUrlOpen", (e: unknown) => {
        const to = appLinkTarget(String((e as { url?: string })?.url ?? ""));
        if (!to) return;
        void plugin("Browser")?.close?.();
        location.assign(to);
      }),
    ).then((h) => (handle = h as { remove?: () => void }));
    return () => handle?.remove?.();
  }, []);
  return null;
}
