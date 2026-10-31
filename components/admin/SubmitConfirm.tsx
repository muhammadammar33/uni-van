"use client";

/** A form's submit button that asks "are you sure?" first. */
export function SubmitConfirm({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={(e) => !window.confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}
