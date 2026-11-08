"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteMyAccount } from "@/app/me/actions";

/** "Delete my account" on My account: explains what goes, and asks them to type DELETE. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, busy] = useActionState(deleteMyAccount, null);
  if (!open)
    return (
      <button type="button" className="btn-ghost w-full !text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Delete my account
      </button>
    );
  return (
    <form action={action} className="card space-y-3 border border-red-200">
      <h2 className="font-bold text-red-700">Delete my account</h2>
      <p className="text-sm text-slate-700">
        This removes your account, your rides and their bookings, your bookings, your reviews, your ID and ID photos, and your WhatsApp chats with
        the Hamsafar team. It can&apos;t be undone.
      </p>
      <label className="block text-sm">
        Type <b>DELETE</b> to confirm
        <input name="confirm" className="input mt-1" autoComplete="off" autoCapitalize="characters" />
      </label>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={() => setOpen(false)}>
          Keep my account
        </button>
        <button className="btn flex-1 bg-red-600 text-white hover:bg-red-700" disabled={busy}>
          {busy ? "Deleting…" : "Delete for good"}
        </button>
      </div>
    </form>
  );
}
