"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Check, CheckCheck, Flag, LockOpen, MessagesSquare, MoreVertical, Send, ShieldAlert, X } from "lucide-react";

type Msg = { id: number; mine: boolean; body: string; at: string };
type View = {
  side: "driver" | "rider";
  otherName: string;
  about: string;
  closed: string | null;
  canReopen: boolean;
  messages: Msg[];
  seenUpTo: number;
  quickReplies: string[];
};

const MAX = 500;
/** How often an open chat checks for new messages, and how often a closed one checks the unread count. */
const OPEN_POLL_MS = 4000;
const PEEK_POLL_MS = 20000;

async function call<T>(id: number, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/chat/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json as T;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/**
 * "Chat" button with an unread badge. `unread` comes from the page's own data (driver); without it the button
 * checks by itself every so often (rider). `autoOpen` opens it on load (a tapped notification).
 */
export function ChatButton({
  chat,
  otherName,
  unread: given,
  autoOpen = false,
  compact = false,
}: {
  chat: { id: number; key: string };
  otherName: string;
  unread?: number;
  autoOpen?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [peeked, setPeeked] = useState(0);
  const unread = open ? 0 : (given ?? peeked);

  useEffect(() => {
    if (given !== undefined || open) return;
    const peek = () =>
      document.visibilityState === "visible" &&
      call<{ unread: number }>(chat.id, { key: chat.key, action: "peek" })
        .then((r) => setPeeked(r.unread))
        .catch(() => {});
    peek();
    const t = setInterval(peek, PEEK_POLL_MS);
    return () => clearInterval(t);
  }, [chat.id, chat.key, given, open]);

  const badge = unread > 0 && (
    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white" aria-label={`${unread} unread`}>
      {unread > 9 ? "9+" : unread}
    </span>
  );
  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative grid size-9 place-items-center rounded-full border border-slate-200 text-brand"
          aria-label={`Chat with ${otherName}${unread ? `, ${unread} unread` : ""}`}
        >
          <MessagesSquare className="size-4" />
          {badge}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary relative w-full">
          <MessagesSquare className="size-4" /> Chat with {otherName.split(" ")[0]}
          {badge}
        </button>
      )}
      {/* Drawn at the top of the page: a card's animation (a CSS transform) would otherwise trap it inside the card. */}
      {open && createPortal(<ChatSheet chat={chat} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** The conversation, full screen on phones and a panel on bigger screens. */
export function ChatSheet({ chat, onClose }: { chat: { id: number; key: string }; onClose: () => void }) {
  const [view, setView] = useState<View | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const lastId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const merge = useCallback((more: Msg[]) => {
    if (!more.length) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...more.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
      lastId.current = next.at(-1)?.id ?? 0;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const v = await call<View>(chat.id, { key: chat.key, action: "load", after: lastId.current });
      setView(v);
      merge(v.messages);
      setError((e) => (e.startsWith("Couldn't") ? "" : e));
    } catch (err) {
      setError(lastId.current ? "Couldn't check for new messages. Retrying…" : (err as Error).message);
    }
  }, [chat.id, chat.key, merge]);

  useEffect(() => {
    poll();
    const t = setInterval(() => document.visibilityState === "visible" && poll(), OPEN_POLL_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [poll, onClose]);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  /** `fromBox`: the typed text (cleared once sent); quick replies leave what's being typed alone. */
  async function send(body: string, fromBox = false) {
    const msg = body.trim();
    if (!msg || sending) return;
    setSending(true);
    setError("");
    try {
      const r = await call<{ message: Msg }>(chat.id, { key: chat.key, action: "send", text: msg });
      merge([r.message]);
      if (fromBox) setText((t) => (t.trim() === msg ? "" : t));
      inputRef.current?.focus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function setClosed(close: boolean) {
    setMenu(false);
    if (close && !confirm(`Close this chat? ${view?.otherName.split(" ")[0] ?? "They"} won't be able to message you here. You can open it again later.`)) return;
    try {
      const v = await call<View>(chat.id, { key: chat.key, action: close ? "close" : "reopen" });
      setView(v);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const other = view?.otherName.split(" ")[0] ?? "";
  const lastMine = [...messages].reverse().find((m) => m.mine);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Chat with ${view?.otherName ?? "your driver"}`} onClick={onClose}>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 shadow-lift sm:h-[min(640px,90dvh)] sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <header className="bg-hero flex items-center gap-3 px-4 py-3 text-white">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-extrabold">{other.charAt(0) || "·"}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{view?.otherName ?? "Chat"}</div>
            <div className="truncate text-xs text-teal-50/90">
              {view ? `${view.side === "rider" ? "Your driver" : "Your rider"} · ${view.about}` : "Loading…"}
            </div>
          </div>
          {view && (
            <div className="relative">
              <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-white/15" aria-label="Chat options" onClick={() => setMenu((m) => !m)}>
                <MoreVertical className="size-5" />
              </button>
              {menu && (
                <div className="absolute right-0 top-10 z-10 w-56 overflow-hidden rounded-2xl bg-white text-sm text-ink shadow-lift">
                  {view.canReopen ? (
                    <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setClosed(false)}>
                      <LockOpen className="size-4" /> Open chat again
                    </button>
                  ) : (
                    !view.closed && (
                      <button type="button" className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setClosed(true)}>
                        <Ban className="size-4" /> Close chat (block)
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setMenu(false);
                      setReporting(true);
                    }}
                  >
                    <Flag className="size-4" /> Report to Hamsafar
                  </button>
                </div>
              )}
            </div>
          )}
          <button type="button" className="grid size-9 place-items-center rounded-full hover:bg-white/15" aria-label="Close chat window" onClick={onClose}>
            <X className="size-5" />
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4" aria-live="polite">
          <p className="mx-auto mb-3 max-w-xs rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-900">
            <ShieldAlert className="mr-1 inline size-3.5 align-[-2px]" />
            Keep chats about the ride. Never share OTPs or send money in advance. Report anything that makes you uncomfortable.
          </p>
          {view && messages.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No messages yet. Say salam to {other}!</p>}
          {messages.map((m, i) => {
            const newDay = i === 0 || day(messages[i - 1].at) !== day(m.at);
            return (
              <div key={m.id}>
                {newDay && <div className="my-2 text-center text-[11px] font-semibold text-slate-400">{day(m.at)}</div>}
                <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] ${m.mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-white text-ink shadow-sm"}`}>
                    {m.body}
                    <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${m.mine ? "text-teal-50/80" : "text-slate-400"}`}>
                      {time(m.at)}
                      {m.mine && (view && m.id <= view.seenUpTo ? <CheckCheck className="size-3.5" aria-label="Seen" /> : <Check className="size-3.5" aria-label="Sent" />)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {lastMine && view && lastMine.id <= view.seenUpTo && <p className="pr-1 text-right text-[11px] text-slate-400">Seen</p>}
        </div>

        {error && <p className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

        {view?.closed ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 text-center text-sm text-slate-500">
            {view.closed}
            {view.canReopen && (
              <button type="button" className="ml-2 font-semibold text-brand" onClick={() => setClosed(false)}>
                Open again
              </button>
            )}
          </div>
        ) : (
          view && (
            <div className="border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {view.quickReplies.map((q) => (
                  <button key={q} type="button" className="shrink-0 rounded-full border border-brand/30 bg-brand-lt/40 px-3 py-1.5 text-xs font-semibold text-brand-dk" disabled={sending} onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(text, true);
                }}
              >
                <textarea
                  ref={inputRef}
                  className="input max-h-32 min-h-11 flex-1 resize-none !py-2.5"
                  rows={1}
                  maxLength={MAX}
                  placeholder={`Message ${other}`}
                  aria-label="Message"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
                      e.preventDefault();
                      send(text, true);
                    }
                  }}
                />
                <button className="btn-primary grid size-11 shrink-0 place-items-center !p-0" disabled={sending || !text.trim()} aria-label="Send">
                  <Send className="size-5" />
                </button>
              </form>
              {text.length > MAX - 50 && <p className="mt-1 text-right text-[11px] text-slate-400">{MAX - text.length} left</p>}
            </div>
          )
        )}
      </div>
      {reporting && view && (
        <ReportDialog
          other={view.otherName}
          onCancel={() => setReporting(false)}
          onSend={async (reason) => {
            await call(chat.id, { key: chat.key, action: "report", reason });
            setReporting(false);
            await poll();
          }}
        />
      )}
    </div>
  );
}

function ReportDialog({ other, onCancel, onSend }: { other: string; onCancel: () => void; onSend: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 p-4" onClick={(e) => (e.stopPropagation(), onCancel())}>
      <form
        className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-lift"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSend(reason);
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <Flag className="size-5 text-red-600" /> Report {other.split(" ")[0]}
        </h2>
        <p className="text-sm text-slate-600">
          The Hamsafar team will get a copy of this conversation and look into it. The chat will be closed. If you&apos;re in danger, call <b>15</b>.
        </p>
        <textarea className="input min-h-24" maxLength={1000} placeholder="What happened?" aria-label="What happened?" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={busy || reason.trim().length < 5}>
            Send report
          </button>
        </div>
      </form>
    </div>
  );
}
