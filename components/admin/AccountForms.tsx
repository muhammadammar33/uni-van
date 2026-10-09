"use client";

import { useActionState, useRef } from "react";
import { keepFields } from "@/lib/keepFields";
import { addAdmin, changePassword, type FormState } from "@/app/admin/actions";

/** Form state for a server action; fields stay after an error and clear after a success. */
function useClearOnSuccess(fn: (state: FormState, form: FormData) => Promise<FormState>) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const res = await fn(prev, form);
    if (res?.ok) ref.current?.reset();
    return res;
  }, undefined);
  return { ref, state, action, pending };
}

function Status({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

export function ChangePasswordForm() {
  const { ref, state, action, pending } = useClearOnSuccess(changePassword);
  return (
    <form ref={ref} onSubmit={keepFields(action)} className="card space-y-3">
      <h2 className="font-semibold">Change your password</h2>
      <input name="current" type="password" required placeholder="Current password" className="input" autoComplete="current-password" />
      <input name="next" type="password" required minLength={8} placeholder="New password (8+ characters)" className="input" autoComplete="new-password" />
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>
        Change password
      </button>
    </form>
  );
}

export function AddAdminForm() {
  const { ref, state, action, pending } = useClearOnSuccess(addAdmin);
  return (
    <form ref={ref} onSubmit={keepFields(action)} className="card space-y-3">
      <h2 className="font-semibold">Add an admin or driver</h2>
      <input name="name" required placeholder="Name" className="input" />
      <input name="email" type="email" required placeholder="Email" className="input" autoComplete="off" />
      <input name="password" type="password" required minLength={8} placeholder="Password (8+ characters)" className="input" autoComplete="new-password" />
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>
        Add admin
      </button>
    </form>
  );
}
