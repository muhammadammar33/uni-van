"use client";

import { useActionState, useRef } from "react";
import { addSuperAdmin, createOrg, updateOrg, type FormState } from "@/app/admin/actions";
import { keepFields } from "@/lib/keepFields";
import { ORG_TYPE_INFO, ORG_TYPES, type OrgType } from "@/lib/orgTypes";

function Status({ state }: { state: FormState }) {
  if (state?.error) return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>;
  if (state?.ok) return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{state.ok}</p>;
  return null;
}

function OrgFields({ initial }: { initial?: { name: string; type: OrgType; city: string; phone: string } }) {
  return (
    <>
      <div>
        <span className="label">Type of client</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {ORG_TYPES.map((t, i) => (
            <label key={t} className="flex min-w-0 cursor-pointer gap-3 rounded-xl border-2 border-slate-200 p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-lt/40">
              <input type="radio" name="type" value={t} defaultChecked={initial ? initial.type === t : i === 0} className="mt-1 accent-brand" />
              <span>
                <span className="block font-semibold">
                  {ORG_TYPE_INFO[t].emoji} {ORG_TYPE_INFO[t].label}
                </span>
                <span className="block text-xs text-slate-500">{ORG_TYPE_INFO[t].blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label" htmlFor="org-name">
            Name
          </label>
          <input id="org-name" name="name" required className="input" defaultValue={initial?.name} placeholder="e.g. COMSATS Wah Transport Office" />
        </div>
        <div>
          <label className="label" htmlFor="org-city">
            City <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="org-city" name="city" className="input" defaultValue={initial?.city} placeholder="Wah Cantt" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="org-phone">
            Contact number for passengers <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="org-phone" name="phone" type="tel" className="input" defaultValue={initial?.phone} placeholder="0300 1234567" />
        </div>
      </div>
    </>
  );
}

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrg, undefined);
  return (
    <form onSubmit={keepFields(action)} className="card space-y-5">
      <h2 className="text-lg font-bold">New organisation</h2>
      <OrgFields />
      <fieldset className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <legend className="px-1 text-sm font-bold">Their first admin</legend>
        <p className="text-sm text-slate-500">They sign in at /admin with this email and password, and can add the rest of their team.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="adminName" required placeholder="Name" className="input" aria-label="Admin name" />
          <input name="adminEmail" type="email" required placeholder="Email" className="input" autoComplete="off" aria-label="Admin email" />
          <input name="adminPassword" type="text" required minLength={8} placeholder="Password (8+ characters)" className="input" autoComplete="off" aria-label="Admin password" />
        </div>
      </fieldset>
      <Status state={state} />
      <button className="btn-primary w-full py-3 sm:w-auto" disabled={pending}>
        {pending ? "Creating…" : "Create organisation"}
      </button>
    </form>
  );
}

export function EditOrgForm({ id, initial }: { id: number; initial: { name: string; type: OrgType; city: string; phone: string } }) {
  const [state, action, pending] = useActionState(updateOrg.bind(null, id), undefined);
  return (
    <form onSubmit={keepFields(action)} className="card min-w-0 space-y-5">
      <h2 className="text-lg font-bold">Details</h2>
      <OrgFields initial={initial} />
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

export function AddSuperAdminForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const res = await addSuperAdmin(prev, form);
    if (res?.ok) ref.current?.reset();
    return res;
  }, undefined);
  return (
    <form ref={ref} onSubmit={keepFields(action)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="name" required placeholder="Name" className="input" aria-label="Name" />
        <input name="email" type="email" required placeholder="Email" className="input" autoComplete="off" aria-label="Email" />
        <input name="password" type="password" required minLength={8} placeholder="Password (8+ characters)" className="input" autoComplete="new-password" aria-label="Password" />
      </div>
      <Status state={state} />
      <button className="btn-ghost" disabled={pending}>
        Add super admin
      </button>
    </form>
  );
}
