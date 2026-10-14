"use client";

import { Portal } from "@/components/Portal";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, LoaderCircle, MessageCircle, ShieldCheck, X } from "lucide-react";
import { displayPhone, normalizePhone } from "@/lib/format";
import type { VerifyMode } from "@/lib/verify";

const STORE = "hamsafar:phone-tokens";

/** Tokens proving this browser verified a number, by phone; dropped once expired. */
function savedToken(phone: string): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(STORE) ?? "{}")[phone];
    if (typeof t !== "string") return null;
    const exp = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp;
    return exp * 1000 > Date.now() + 60_000 ? t : null;
  } catch {
    return null;
  }
}

function saveToken(phone: string, token: string) {
  try {
    const all = JSON.parse(localStorage.getItem(STORE) ?? "{}");
    all[phone] = token;
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {}
}

/**
 * WhatsApp number check before booking or offering a ride. `ensure(phone)` resolves to a token for the API
 * ("" when this site doesn't check numbers), or null if the person closed the check. Render `dialog`.
 */
export function usePhoneVerify(mode: VerifyMode) {
  const [pending, setPending] = useState<{ phone: string; resolve: (t: string | null) => void } | null>(null);
  const ensure = useCallback(
    async (phoneRaw: string): Promise<string | null> => {
      if (!mode) return "";
      const phone = normalizePhone(phoneRaw);
      if (!phone) return null;
      const saved = savedToken(phone);
      if (saved) return saved;
      return new Promise((resolve) => setPending({ phone, resolve }));
    },
    [mode],
  );
  const dialog =
    pending && mode ? (
      <VerifyDialog
        phone={pending.phone}
        mode={mode}
        onDone={(token) => {
          if (token) saveToken(pending.phone, token);
          pending.resolve(token);
          setPending(null);
        }}
      />
    ) : null;
  return { ensure, dialog };
}

/** "Verified" tick next to a phone field once this browser has checked that number. */
export function VerifiedHint({ mode, phone }: { mode: VerifyMode; phone: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const p = normalizePhone(phone);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after typing
    setOk(!!p && !!savedToken(p));
  }, [phone]);
  if (!mode) return null;
  return ok ? (
    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
      <BadgeCheck className="size-3.5" /> WhatsApp number verified
    </p>
  ) : (
    <p className="mt-1 text-xs text-slate-500">We&apos;ll check this number on WhatsApp.</p>
  );
}

type Started = { id: string; method: "send" | "message"; phone: string; text?: string; link?: string };

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json as T;
}

function VerifyDialog({ phone, mode, onDone }: { phone: string; mode: NonNullable<VerifyMode>; onDone: (token: string | null) => void }) {
  const [started, setStarted] = useState<Started | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  const start = useCallback(
    async (method: "send" | "message") => {
      setBusy(true);
      setError(null);
      setCode("");
      try {
        const r = await call<{ required: boolean } & Partial<Started>>("/api/verify/start", { phone, method });
        if (!r.required) return onDone("");
        setStarted(r as Started);
        if (r.method === "send") {
          setResendIn(30);
          setTimeout(() => codeInput.current?.focus(), 50);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [phone, onDone],
  );

  const check = useCallback(
    async (value: string) => {
      if (!started || value.length !== 6) return;
      setBusy(true);
      setError(null);
      try {
        onDone((await call<{ token: string }>("/api/verify/check", { id: started.id, code: value })).token);
      } catch (err) {
        setError((err as Error).message);
        setCode("");
      } finally {
        setBusy(false);
      }
    },
    [started, onDone],
  );

  // Resend countdown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // "Message us" checks: wait for the WhatsApp to arrive.
  useEffect(() => {
    if (started?.method !== "message") return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await call<{ verified: boolean; token?: string; expired?: boolean }>(`/api/verify/status?id=${encodeURIComponent(started.id)}`);
        if (stop) return;
        if (r.verified && r.token) return onDone(r.token);
        if (r.expired) return setError("This check expired. Start again.");
      } catch {}
      if (!stop) setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 2500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [started, onDone]);

  const shown = displayPhone(phone);
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => onDone(null)}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-title"
          className="w-full max-w-md animate-rise rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#25D366]/15 text-[#128C7E]">
              <ShieldCheck className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="verify-title" className="text-lg font-extrabold">
                Verify your WhatsApp number
              </h2>
              <p className="text-sm text-slate-500">{shown}. Once per phone: it keeps every number on Hamsafar real.</p>
            </div>
            <button type="button" onClick={() => onDone(null)} className="grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {!started && (
              <>
                {mode.send && (
                  <button type="button" className="btn w-full bg-[#25D366] py-3 text-white hover:bg-[#1ebe5b]" disabled={busy} onClick={() => start("send")}>
                    {busy ? <LoaderCircle className="size-5 animate-spin" /> : <MessageCircle className="size-5" />} Send me a code on WhatsApp
                  </button>
                )}
                {mode.message && (
                  <button type="button" className={mode.send ? "btn-ghost w-full" : "btn w-full bg-[#25D366] py-3 text-white hover:bg-[#1ebe5b]"} disabled={busy} onClick={() => start("message")}>
                    {!mode.send && <MessageCircle className="size-5" />} {mode.send ? "Or verify by sending us a WhatsApp" : "Verify by sending us a WhatsApp"}
                  </button>
                )}
              </>
            )}

            {started?.method === "send" && (
              <>
                <p className="text-sm">
                  We sent a 6-digit code to <b>{shown}</b> on WhatsApp.
                </p>
                <input
                  ref={codeInput}
                  className="input text-center font-mono text-2xl tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label="6-digit code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    if (v.length === 6) check(v);
                  }}
                />
                <button type="button" className="btn-primary w-full py-3" disabled={busy || code.length !== 6} onClick={() => check(code)}>
                  {busy ? "Checking…" : "Verify"}
                </button>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <button type="button" className="font-semibold text-brand disabled:text-slate-400" disabled={resendIn > 0 || busy} onClick={() => start("send")}>
                    {resendIn > 0 ? `Send again in ${resendIn}s` : "Send the code again"}
                  </button>
                  {mode.message && (
                    <button type="button" className="font-semibold text-slate-500 hover:text-ink" onClick={() => start("message")}>
                      Didn&apos;t get it? Message us instead
                    </button>
                  )}
                </div>
              </>
            )}

            {started?.method === "message" && (
              <>
                <ol className="space-y-1 text-sm text-slate-700">
                  <li>1. Tap the button: WhatsApp opens with a message ready.</li>
                  <li>
                    2. Press <b>Send</b> (from {shown}).
                  </li>
                  <li>3. Come back here: it continues by itself.</li>
                </ol>
                <a href={started.link} target="_blank" rel="noreferrer" className="btn w-full bg-[#25D366] py-3 text-white hover:bg-[#1ebe5b]">
                  <MessageCircle className="size-5" /> Open WhatsApp
                </a>
                <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin" /> Waiting for your message…
                </p>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
