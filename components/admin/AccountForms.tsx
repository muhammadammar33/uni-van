"use client";

import { useActionState } from "react";
import { addAdmin, changePassword } from "@/app/admin/actions";

function Status({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-emerald-700">{state.ok}</p>;
  return null;
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="card space-y-3">
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
  const [state, action, pending] = useActionState(addAdmin, undefined);
  return (
    <form action={action} className="card space-y-3">
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
