"use client";

import { useTransition } from "react";

/** Runs a server action after a confirm() prompt. */
export function ConfirmButton({
  action,
  confirm: question,
  className,
  children,
  title,
}: {
  action: () => Promise<unknown>;
  confirm?: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      className={className}
      disabled={pending}
      onClick={() => {
        if (question && !window.confirm(question)) return;
        start(async () => {
          await action();
        });
      }}
    >
      {children}
    </button>
  );
}
