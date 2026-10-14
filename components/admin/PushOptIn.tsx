"use client";

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";

const b64 = (s: string) => {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Turns on notifications on this phone/computer: new IDs to verify and new WhatsApp messages. */
export function PushOptIn({ title = "Get notified when someone sends their ID" }: { title?: string }) {
  const [state, setState] = useState<"unknown" | "off" | "on" | "blocked" | "unsupported" | "busy">("unknown");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after hydration
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("blocked");
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => setState((await reg?.pushManager.getSubscription()) ? "on" : "off"));
  }, []);

  async function enable() {
    setState("busy");
    setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/admin/push")).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const res = await fetch("/api/admin/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setState("off");
      setMsg("Couldn't turn notifications on here. On iPhone, first add Hamsafar to your Home Screen (Share → Add to Home Screen), then open it from there.");
    }
  }

  async function test() {
    await fetch("/api/admin/push/test", { method: "POST" });
    setMsg("Sent: it should appear in a few seconds.");
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 !p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-lt text-brand">
        <BellRing className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-bold">{title}</div>
        <p className="text-sm text-slate-500">
          {state === "on"
            ? "Notifications are on for this device."
            : state === "blocked"
              ? "Notifications are blocked for this site in your browser settings."
              : state === "unsupported"
                ? /iPhone|iPad/.test(navigator.userAgent)
                  ? "On iPhone: tap Share → Add to Home Screen, open Hamsafar from the new icon, sign in, and turn notifications on there."
                  : "This browser can't show notifications."
                : "Turn it on on your phone so you can verify people quickly (within 24 hours)."}
        </p>
        {msg && <p className="mt-1 text-sm text-slate-600">{msg}</p>}
      </div>
      {state === "on" ? (
        <button type="button" className="btn-ghost" onClick={test}>
          <Check className="size-4" /> Send a test
        </button>
      ) : (
        (state === "off" || state === "busy") && (
          <button type="button" className="btn-primary" disabled={state === "busy"} onClick={enable}>
            Turn on notifications
          </button>
        )
      )}
    </div>
  );
}
