"use client";

import { useState } from "react";
import { BellRing, Check } from "lucide-react";

/**
 * On an empty search: "Notify me when a ride is offered on this route". Signed-out visitors sign in first and
 * come back here. Notifications arrive in the Hamsafar app.
 */
export function RouteAlertButton({ from, to, kind, signedIn, days }: { from: string; to: string; kind: string; signedIn: boolean; days: number }) {
  const [state, setState] = useState<"" | "busy" | "done">("");
  const [error, setError] = useState("");
  async function save() {
    if (!signedIn) {
      window.location.assign(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setState("busy");
    setError("");
    const res = await fetch("/api/me/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from, to, kind }) }).catch(() => null);
    if (res?.ok) return setState("done");
    setState("");
    setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save the alert. Please try again.");
  }
  if (state === "done")
    return (
      <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
        <Check className="size-4" /> We’ll notify you in the Hamsafar app when a ride is offered on this route (for {days} days).
      </p>
    );
  return (
    <div className="mt-4 space-y-2">
      <button type="button" className="btn-primary w-full" onClick={save} disabled={state === "busy"}>
        <BellRing className="size-4" /> {signedIn ? "Notify me when a ride is offered" : "Sign in to get notified"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">Notifications arrive in the Hamsafar app. You can stop them any time from your account.</p>
    </div>
  );
}
