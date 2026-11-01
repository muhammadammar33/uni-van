"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Official sites can't be filled in from here (other sites' forms, captchas), so the link copies the value as it
 * opens the site: the admin just pastes it there.
 */
export function CopyOpen({ href, value, children }: { href: string; value: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Copies ${value}, then opens the site: paste it into the form`}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 4000);
          },
          () => {},
        );
      }}
      className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"
    >
      {children}
      {copied && (
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
          <Check className="inline size-3" /> {value} copied: paste it
        </span>
      )}
    </a>
  );
}

/** A value with a copy button (licence or plate number). */
export function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value).then(() => (setCopied(true), setTimeout(() => setCopied(false), 2500)), () => {})}
      className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold text-ink hover:bg-slate-200"
      title="Copy"
    >
      {value} {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-slate-500" />}
    </button>
  );
}

