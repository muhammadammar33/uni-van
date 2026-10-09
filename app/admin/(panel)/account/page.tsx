import { asc } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { AddAdminForm, ChangePasswordForm } from "@/components/admin/AccountForms";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { requireAdmin } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { removeAdmin } from "../../actions";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await requireAdmin();
  const admins = await requireDb()
    .select({ id: s.admins.id, name: s.admins.name, email: s.admins.email })
    .from(s.admins)
    .orderBy(asc(s.admins.id));
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">Account</h1>
      <div className="grid gap-5 md:grid-cols-2">
        <section className="card md:col-span-2">
          <h2 className="mb-3 font-semibold">Admins</h2>
          <ul className="divide-y divide-slate-100">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <div className="font-medium">
                    {a.name} {a.id === me.id && <span className="text-xs text-slate-400">(you)</span>}
                  </div>
                  <div className="text-sm text-slate-500">{a.email}</div>
                </div>
                {a.id !== me.id && (
                  <ConfirmButton action={removeAdmin.bind(null, a.id)} confirm={`Remove ${a.name}?`} className="p-2 text-slate-400 hover:text-red-600" title="Remove">
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                )}
              </li>
            ))}
          </ul>
        </section>
        <AddAdminForm />
        <ChangePasswordForm />
      </div>
    </>
  );
}
