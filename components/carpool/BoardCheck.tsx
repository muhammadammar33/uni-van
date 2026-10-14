"use client";

import { useState } from "react";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { todayLocal } from "@/lib/format";
import type { RideBookingView } from "@/lib/rides";

/**
 * "Is this my driver?": in the car, the rider types the 4-digit ride code the driver tells them.
 * A match means it's the driver they booked; anything else, they shouldn't get in.
 */
export function BoardCheck({ slug, booking, onBoarded }: { slug: string; booking: RideBookingView; onBoarded: (b: RideBookingView) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState<{ error: string; triesLeft: number | null } | null>(null);

  if (booking.boarded)
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3 text-emerald-900" role="status">
        <ShieldCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" />
        <div>
          <div className="font-bold">Right driver: you&apos;re on board</div>
          <p className="text-sm">The ride code matched {booking.driverName.split(" ")[0]}&apos;s ride. Have a safe trip!</p>
        </div>
      </div>
    );

  if (booking.date !== todayLocal())
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-brand" />
        <p>
          <b className="text-ink">On the day, check your driver:</b> when you get in, ask the driver for the 4-digit <b>ride code</b> and type it here. If it doesn&apos;t match, don&apos;t
          get in.
        </p>
      </div>
    );

  const locked = wrong?.triesLeft === 0 || booking.codeTriesLeft === 0;

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setWrong(null);
    try {
      const res = await fetch(`/api/rides/${slug}/board`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: booking.phone, code: booking.code, rideCode: code }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) return onBoarded(j.booking);
      setWrong({ error: j.error ?? "Couldn't check the code. Try again.", triesLeft: typeof j.triesLeft === "number" ? j.triesLeft : null });
      setCode("");
    } catch {
      setWrong({ error: "No connection. Try again.", triesLeft: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={check} className="space-y-2 rounded-2xl border-2 border-brand/30 bg-brand-lt/30 p-3">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-brand" />
        <div>
          <label htmlFor="ride-code" className="font-bold">
            Getting in? Check your driver
          </label>
          <p className="text-sm text-slate-600">Ask the driver for the 4-digit ride code and type it here before you get in.</p>
        </div>
      </div>
      {!locked && (
        <div className="flex gap-2">
          <input
            id="ride-code"
            className="input flex-1 text-center font-mono text-xl tracking-[0.4em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            placeholder="0000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          <button className="btn-primary shrink-0 px-5" disabled={busy || code.length !== 4}>
            {busy ? "Checking…" : "Check"}
          </button>
        </div>
      )}
      {(wrong || locked) && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900" role="alert">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" />
          <div>
            <b>{wrong?.error ?? "Too many wrong codes. Don't get in."}</b>
            {!locked && wrong?.triesLeft != null && <span> {wrong.triesLeft} tries left.</span>}
            <p className="mt-1">
              Check the car and number plate in your booking, or call the driver. If you feel unsafe, call <a href="tel:15" className="font-bold underline">15</a> (Police).
            </p>
          </div>
        </div>
      )}
    </form>
  );
}
