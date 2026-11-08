"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { appPlatform, inApp, plugin } from "@/lib/nativeApp";

const ASKED_KEY = "hamsafar:push-asked";
type Perm = { receive?: string };

/**
 * Push notifications in the app for a signed-in person: new bookings, ride started, ID approved... First a
 * small card explains why (so Android's prompt isn't a surprise); then the phone registers with the site.
 * Tapping a notification opens its page. Does nothing on the website, or until the server has Firebase set up.
 */
export function AppPush() {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!inApp()) return;
    const push = plugin("PushNotifications");
    if (!push?.register) return;
    const handles: { remove?: () => void }[] = [];
    const listen = (event: string, cb: (e: unknown) => void) =>
      Promise.resolve(push.addListener?.(event, cb)).then((h) => handles.push(h as { remove?: () => void }));

    void listen("registration", (e) => {
      const token = String((e as { value?: string })?.value ?? "");
      if (!token) return;
      document.cookie = `hs_push=${token}; path=/; max-age=31536000; samesite=lax; secure`;
      void fetch("/api/me/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, platform: appPlatform() }) });
    });
    void listen("pushNotificationActionPerformed", (e) => {
      const url = String((e as { notification?: { data?: { url?: string } } })?.notification?.data?.url ?? "");
      if (url.startsWith("/") && !url.startsWith("//")) window.location.assign(url);
    });

    (async () => {
      const me = (await fetch("/api/me/devices").then((r) => r.json()).catch(() => null)) as { signedIn?: boolean; push?: boolean } | null;
      if (!me?.signedIn || !me.push) return;
      if (appPlatform() === "android")
        await Promise.resolve(push.createChannel?.({ id: "rides", name: "Rides and bookings", description: "Bookings, rides starting, and your ID check", importance: 4, visibility: 1 })).catch(() => {});
      const perm = (await Promise.resolve(push.checkPermissions?.()).catch(() => null)) as Perm | null;
      if (perm?.receive === "granted") return void Promise.resolve(push.register()).catch(() => {});
      if (perm?.receive === "denied") return;
      let asked = 0;
      try {
        asked = Number(localStorage.getItem(ASKED_KEY) ?? 0);
      } catch {}
      if (Date.now() - asked > 14 * 24 * 3600 * 1000) setAsk(true);
    })();
    return () => handles.forEach((h) => h?.remove?.());
  }, []);

  if (!ask) return null;
  const decide = async (yes: boolean) => {
    setAsk(false);
    try {
      localStorage.setItem(ASKED_KEY, String(Date.now()));
    } catch {}
    if (!yes) return;
    const push = plugin("PushNotifications");
    const perm = (await Promise.resolve(push?.requestPermissions?.()).catch(() => null)) as Perm | null;
    if (perm?.receive === "granted") await Promise.resolve(push?.register?.()).catch(() => {});
  };
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl bg-ink p-4 text-white shadow-xl" role="dialog" aria-labelledby="push-title">
      <button type="button" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-white/70" aria-label="Close" onClick={() => decide(false)}>
        <X className="size-4" />
      </button>
      <p id="push-title" className="flex items-center gap-2 pr-8 font-bold">
        <BellRing className="size-5 text-accent" /> Get notified about your rides
      </p>
      <p className="mt-1 text-sm text-white/80">New bookings, your ride starting, and your ID check. Only about your own rides.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn flex-1 bg-white/10 text-white" onClick={() => decide(false)}>
          Not now
        </button>
        <button type="button" className="btn flex-1 bg-accent text-ink" onClick={() => decide(true)}>
          Turn on
        </button>
      </div>
    </div>
  );
}
