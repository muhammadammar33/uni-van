"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, SendHorizontal, X } from "lucide-react";

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
