"use client";

import { useState } from "react";
import { BadgeCheck, Car, CircleCheckBig, IdCard, MessageCircle, User } from "lucide-react";
import { useIdVerify } from "@/components/carpool/IdVerify";
import { usePhoneVerify } from "@/components/carpool/PhoneVerify";
import type { Account } from "@/lib/account";
import { displayPhone, normalizePhone } from "@/lib/format";
import type { IdStatus } from "@/lib/identity";
import type { VerifyMode } from "@/lib/verify";

const ok = (x?: string) => x === "pending" || x === "approved";

function Step({ n, step, title, children }: { n: number; step: number; title: string; children: React.ReactNode }) {
  return (
    <section className={`card space-y-3 ${step === n ? "" : "opacity-60"}`}>
      <h2 className="flex items-center gap-3 text-lg font-bold">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-extrabold ${step > n ? "bg-emerald-500 text-white" : step === n ? "bg-brand text-white" : "bg-slate-200 text-slate-500"}`}>
          {step > n ? "✓" : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Right after the first Google sign-in: 1) the WhatsApp number (checked once, from this phone's WhatsApp),
 * 2) the ID check as a rider or a driver, 3) on to where they were going.
 */
export function Onboarding({ account, verify, status: initialStatus, next, driverFirst }: { account: Account; verify: VerifyMode; status: IdStatus | null; next: string; driverFirst: boolean }) {
  const [phone, setPhone] = useState(account.phone ? displayPhone(account.phone) : "");
  const [saved, setSaved] = useState(!!account.phone);
  const [status, setStatus] = useState<IdStatus | null>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneCheck = usePhoneVerify(verify, account.phone);
  const idCheck = useIdVerify();
  const done = !!status && (ok(status.riderStatus) || ok(status.driverStatus));
  const step = !saved ? 1 : done ? 3 : 2;

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!normalizePhone(phone)) return setError("Enter your WhatsApp number, e.g. 0300 1234567");
    const token = await phoneCheck.ensure(phone);
    if (token === null) return setError("Verify your WhatsApp number to continue.");
    setBusy(true);
    try {
      const res = await fetch("/api/me/phone", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, phoneToken: token }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't save your number. Please try again.");
      setPhone(displayPhone(j.phone));
      setStatus(j.status);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyId(role: "rider" | "driver") {
    setError(null);
    const st = await idCheck.ensure(role, { phone, name: account.name }, status ?? undefined);
    if (st) setStatus(st);
  }

  return (
    <div className="space-y-4">
      <Step n={1} step={step} title="Your WhatsApp number">
        {saved ? (
          <p className="flex items-center gap-2 font-semibold text-emerald-700">
            <BadgeCheck className="size-5" /> {phone}
          </p>
        ) : (
          <form onSubmit={savePhone} className="space-y-3">
            <p className="flex items-start gap-2 rounded-xl bg-[#25D366]/10 p-3 text-sm font-semibold text-[#075E54]">
              <MessageCircle className="mt-0.5 size-4 shrink-0" />
              Use the WhatsApp number that&apos;s signed in on this phone. You&apos;ll send a short message from it to confirm it&apos;s yours.
            </p>
            <input
              className="input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0300 1234567"
              aria-label="WhatsApp number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "Saving…" : "Verify my number"}
            </button>
          </form>
        )}
      </Step>

      <Step n={2} step={step} title="Verify your ID">
        {step === 2 && (
          <>
            {status?.riderStatus === "rejected" || status?.driverStatus === "rejected" ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
                Your ID wasn&apos;t approved{status.rejectReason ? `: ${status.rejectReason}` : ""}. Please send it again.
              </p>
            ) : (
              <p className="text-sm text-slate-600">Once only. Only the Hamsafar team sees your ID, never drivers or riders.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["rider", "I'll ride", "CNIC (or B-form if under 18) and a selfie. About 1 minute.", User],
                  ["driver", "I'll drive (and ride)", "CNIC, driving licence, car registration, a photo of your car and a selfie. About 3 minutes.", Car],
                ] as const
              )
                .slice()
                .sort((a) => (driverFirst ? (a[0] === "driver" ? -1 : 1) : a[0] === "rider" ? -1 : 1))
                .map(([role, title, text, Icon]) => (
                  <button key={role} type="button" onClick={() => verifyId(role)} className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 p-4 text-left transition hover:border-brand hover:bg-brand-lt/30">
                    <Icon className="mt-0.5 size-6 shrink-0 text-brand" />
                    <span>
                      <span className="block font-bold">{title}</span>
                      <span className="block text-sm text-slate-600">{text}</span>
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
      </Step>

      {step === 3 && (
        <section className="card animate-rise space-y-3 text-center">
          <CircleCheckBig className="mx-auto size-12 text-emerald-500" />
          <h2 className="text-xl font-extrabold">You&apos;re all set</h2>
          <p className="text-slate-600">
            {status?.riderStatus === "approved" || status?.driverStatus === "approved"
              ? "Your ID is verified."
              : "We check your ID within 24 hours. You can book rides meanwhile; rides you offer go live as soon as you're approved."}
          </p>
          <a href={next} className="btn-primary w-full py-3">
            <IdCard className="size-4" /> Continue
          </a>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
      {phoneCheck.dialog}
      {idCheck.dialog}
    </div>
  );
}
