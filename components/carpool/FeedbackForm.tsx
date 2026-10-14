"use client";

import { useState } from "react";
import Link from "next/link";
import { Bug, Car, CircleCheckBig, Heart, Lightbulb, PhoneCall, ShieldAlert, User, Users } from "lucide-react";

type Kind = "idea" | "problem" | "safety" | "praise";
type Role = "rider" | "driver" | "other";

const KINDS: { k: Kind; label: string; icon: typeof Bug; on: string }[] = [
  { k: "idea", label: "Idea", icon: Lightbulb, on: "border-blue-500 bg-blue-50 text-blue-800" },
  { k: "problem", label: "Problem", icon: Bug, on: "border-amber-500 bg-amber-50 text-amber-800" },
  { k: "safety", label: "Safety", icon: ShieldAlert, on: "border-red-500 bg-red-50 text-red-800" },
  { k: "praise", label: "Praise", icon: Heart, on: "border-emerald-500 bg-emerald-50 text-emerald-800" },
];
const ROLES: { r: Role; label: string; icon: typeof Bug }[] = [
  { r: "rider", label: "Rider", icon: Users },
  { r: "driver", label: "Driver", icon: Car },
  { r: "other", label: "Other", icon: User },
];
const HINTS: Record<Kind, string> = {
  idea: "What would make Hamsafar better for you? A place missing from the list, a feature…",
  problem: "What happened, and on which page? What did you expect?",
  safety: "What happened, when, and on which ride? Include the driver's or rider's name if you know it.",
  praise: "What did you like? We'll share it with the team (and the driver, if it's about one).",
};

/** Ideas, problems and safety reports for the Hamsafar team. */
export function FeedbackForm({ initialKind, initialRole, ride, from }: { initialKind?: Kind; initialRole?: Role; ride: string; from: string }) {
  const [kind, setKind] = useState<Kind | null>(initialKind ?? null);
  const [role, setRole] = useState<Role | null>(initialRole ?? null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return setError("Choose what it's about.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, role: role ?? "other", message, name, contact, page: from, ride, website }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send. Please try again.");
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <section className="card animate-rise text-center">
        <CircleCheckBig className="mx-auto size-12 animate-pop text-emerald-600" />
        <h2 className="mt-3 text-xl font-extrabold">Thank you!</h2>
        <p className="mt-1 text-slate-600">
          We got your message.{contact ? " If we need more details, we'll contact you." : ""} Every message helps us make Hamsafar better.
        </p>
        {kind === "safety" && <Emergency />}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={from} className="btn-primary">
            Back
          </Link>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setSent(false);
              setMessage("");
            }}
          >
            Send another
          </button>
        </div>
      </section>
    );

  return (
    <form onSubmit={send} className="card space-y-5">
      <div>
        <span className="label">What&apos;s it about?</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map(({ k, label, icon: Icon, on }) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 font-semibold ${kind === k ? on : "border-slate-200 text-slate-600"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      {kind === "safety" && <Emergency />}
      <div>
        <span className="label">You are a</span>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(({ r, label, icon: Icon }) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => setRole(r)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 font-semibold ${role === r ? "border-brand bg-brand-lt/50 text-brand" : "border-slate-200 text-slate-600"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="fb-message">
          Your message
        </label>
        <textarea
          id="fb-message"
          required
          minLength={5}
          maxLength={2000}
          className="input min-h-36"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind ? HINTS[kind] : "Tell us what's on your mind."}
        />
        {ride && <p className="mt-1 text-xs text-slate-500">We&apos;ll know which ride this is about.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fb-name">
            Name <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="fb-name" className="input" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fb-contact">
            Phone or email <span className="font-normal text-slate-400">(if you want a reply)</span>
          </label>
          <input id="fb-contact" className="input" maxLength={100} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="0300 1234567" />
        </div>
      </div>
      {/* Spam trap: hidden from people, bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" value={website} onChange={(e) => setWebsite(e.target.value)} />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
      <button className="btn-primary w-full py-3.5 text-base" disabled={busy || !kind || message.trim().length < 5}>
        {busy ? "Sending…" : "Send to the Hamsafar team"}
      </button>
      <p className="text-center text-xs text-slate-500">Only the Hamsafar team sees this. Your contact details are never shown to anyone else.</p>
    </form>
  );
}

function Emergency() {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-900">
      <PhoneCall className="mt-0.5 size-5 shrink-0" />
      <p>
        <b>In danger right now?</b> Call <a href="tel:15" className="font-bold underline">15</a> (Police) or{" "}
        <a href="tel:1122" className="font-bold underline">1122</a> (Rescue) first. Then tell us here.
      </p>
    </div>
  );
}
