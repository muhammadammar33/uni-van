"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Paperclip, SendHorizontal, X } from "lucide-react";

/**
 * Keeps the page up to date: every few seconds while it's on screen, at once when the app comes back to the
 * front (phones pause timers in the background), and at once when a notification arrives.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const t = setInterval(refresh, seconds * 1000);
    const onMessage = (e: MessageEvent) => e.data?.type === "hamsafar-push" && router.refresh();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router, seconds]);
  return null;
}

/** Keeps the conversation scrolled to the newest message. */
export function ScrollToEnd({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "end" }), [count]);
  return <div ref={ref} />;
}

/** Reply box: text, and a photo / audio / video / file to attach. */
export function Composer({ waId }: { waId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    if (file && file.size > 4 * 1024 * 1024) return setError("Files can be 4 MB at most from here.");
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("waId", waId);
    fd.set("text", text);
    if (file) fd.set("file", file);
    try {
      const res = await fetch("/api/admin/wa-reply", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Couldn't send.");
      setText("");
      setFile(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="sticky bottom-0 space-y-2 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
      {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      {file && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm">
          <Paperclip className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" aria-label="Remove file" onClick={() => setFile(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600" aria-label="Attach a photo, audio or file" onClick={() => input.current?.click()}>
          <Paperclip className="size-5" />
        </button>
        <input ref={input} type="file" className="hidden" accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => (setFile(e.target.files?.[0] ?? null), (e.target.value = ""))} />
        <textarea
          className="input max-h-40 min-h-11 flex-1 resize-none py-2.5"
          rows={1}
          placeholder={file ? "Caption (optional)" : "Message"}
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button className="grid size-11 shrink-0 place-items-center rounded-full bg-[#25D366] text-white disabled:opacity-50" disabled={busy || (!text.trim() && !file)} aria-label="Send">
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </form>
  );
}

/** Start a chat with any number: opens its conversation (03xx… or with the country code). */
export function NewChat() {
  const router = useRouter();
  const [num, setNum] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        let d = num.replace(/\D/g, "");
        if (/^03\d{9}$/.test(d)) d = "92" + d.slice(1);
        else if (/^3\d{9}$/.test(d)) d = "92" + d;
        if (!/^\d{10,15}$/.test(d)) return setError("Enter a WhatsApp number, e.g. 0300 1234567 or +44 7700 900123.");
        setError(null);
        router.push(`/admin/whatsapp/${d}`);
      }}
    >
      <input
        className="input min-w-0 flex-1"
        inputMode="tel"
        placeholder="New chat: 0300 1234567"
        aria-label="WhatsApp number for a new chat"
        value={num}
        onChange={(e) => setNum(e.target.value)}
      />
      <button className="btn-primary shrink-0">
        <MessageSquarePlus className="size-4" /> New chat
      </button>
      {error && <p className="w-full text-sm text-red-700">{error}</p>}
    </form>
  );
}

export type TemplateOption = { name: string; language: string; body: string; params: number };

/**
 * Outside the 24-hour window WhatsApp only delivers approved templates: pick one, fill its blanks, send.
 * Once they reply, the normal reply box comes back.
 */
export function TemplateComposer({ waId, templates, error, fresh, account, others = [] }: { waId: string; templates: TemplateOption[]; error: string | null; fresh: boolean; account?: string; others?: string[] }) {
  const router = useRouter();
  const [name, setName] = useState(templates[0]?.name ?? "");
  const [values, setValues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = templates.find((x) => x.name === name);
  const preview = t ? t.body.replace(/\{\{(\d+)\}\}/g, (m, n) => values[Number(n) - 1] || m) : "";
  async function send() {
    if (!t) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/admin/wa-template", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ waId, name: t.name, values }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j.error ?? "Couldn't send. Please try again.");
    setValues([]);
    router.refresh();
  }
  return (
    <div className="space-y-2 border-t border-slate-200 bg-white p-3 text-sm">
      <p className="text-slate-600">
        {fresh ? "Start the chat (they haven't written to you yet)" : "It's been over 24 hours since their last message"}: WhatsApp only allows an approved template first. Once they reply, you can write freely.
      </p>
      {error && !templates.length ? (
        <p className="text-red-700">Couldn&apos;t load your templates: {error}</p>
      ) : !templates.length ? (
        <p className="text-amber-800">No approved templates yet. Create one in WhatsApp Manager → Message templates (category Utility or Marketing), then come back.</p>
      ) : (
        <>
          <select className="input" aria-label="Template" value={name} onChange={(e) => (setName(e.target.value), setValues([]))}>
            {templates.map((x) => (
              <option key={x.name + x.language} value={x.name}>
                {x.name} ({x.language})
              </option>
            ))}
          </select>
          {t &&
            Array.from({ length: t.params }, (_, i) => (
              <input
                key={i}
                className="input"
                placeholder={`Blank {{${i + 1}}}`}
                value={values[i] ?? ""}
                onChange={(e) => setValues((v) => Object.assign([...v], { [i]: e.target.value }))}
              />
            ))}
          {t && <p className="whitespace-pre-wrap rounded-xl bg-[#d9fdd3] p-2.5 text-slate-800">{preview}</p>}
          {err && <p className="text-red-700">{err}</p>}
          <button type="button" className="btn-primary w-full" disabled={busy || !t} onClick={send}>
            <SendHorizontal className="size-4" /> {busy ? "Sending…" : "Send template"}
          </button>
          <p className="text-xs text-slate-500">
            {templates.length} approved template{templates.length === 1 ? "" : "s"}
            {account ? ` from WhatsApp Business Account ${account}` : ""}. New ones appear here once Meta approves them.
            {others.length > 0 && ` Not usable yet: ${others.join(", ")}.`}
          </p>
        </>
      )}
    </div>
  );
}
