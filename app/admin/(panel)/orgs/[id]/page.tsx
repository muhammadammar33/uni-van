import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { ArrowLeft, ExternalLink, LayoutDashboard, Power, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { CopyButton } from "@/components/admin/CopyButton";
import { EditOrgForm } from "@/components/admin/OrgForms";
import { requireSuper } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { displayPhone, todayLocal } from "@/lib/format";
import { orgInfo } from "@/lib/orgTypes";
import { siteUrl } from "@/lib/url";
import { deleteOrg, openOrg, removeAdmin, setOrgActive } from "../../../actions";

export const metadata = { title: "Organisation" };

export default async function OrgPage({ params }: PageProps<"/admin/orgs/[id]">) {
  await requireSuper();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = requireDb();
  const [org] = await db.select().from(s.organizations).where(eq(s.organizations.id, id));
  if (!org) notFound();
  const [admins, [{ trips }], [{ riders }]] = await Promise.all([
    db.select({ id: s.admins.id, name: s.admins.name, email: s.admins.email }).from(s.admins).where(eq(s.admins.orgId, id)).orderBy(asc(s.admins.id)),
    db.select({ trips: count() }).from(s.trips).where(eq(s.trips.orgId, id)),
    db.select({ riders: count() }).from(s.riders).where(eq(s.riders.orgId, id)),
  ]);
  const [{ upcoming }] = await db
    .select({ upcoming: count() })
    .from(s.trips)
    .where(and(gte(s.trips.date, todayLocal()), eq(s.trips.orgId, id)));
  const info = orgInfo(org.type);
  const publicUrl = `${siteUrl(await headers())}/o/${org.slug}`;

  return (
    <>
      <Link href="/admin/orgs" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Organisations
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-brand">
            {info.emoji} {info.label}
          </span>
          <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[org.city, org.phone && displayPhone(org.phone), `${trips} trips (${upcoming} upcoming)`, info.roster ? `${riders} ${info.riders}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={openOrg.bind(null, id)}>
            <button className="btn-primary">
              <LayoutDashboard className="size-4" /> Open dashboard
            </button>
          </form>
          <ConfirmButton
            action={setOrgActive.bind(null, id, !org.active)}
            confirm={org.active ? `Switch off ${org.name}? Their admins can't sign in and nobody can book until you switch it back on.` : undefined}
            className={org.active ? "btn-danger" : "btn-ghost"}
          >
            <Power className="size-4" /> {org.active ? "Switch off" : "Switch on"}
          </ConfirmButton>
        </div>
      </div>
      {!org.active && <p className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Switched off: admins can&apos;t sign in and booking links show &ldquo;not available&rdquo;.</p>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <EditOrgForm id={id} initial={{ name: org.name, type: org.type, city: org.city ?? "", phone: org.phone ? displayPhone(org.phone) : "" }} />
        <div className="space-y-5">
          <section className="card">
            <h2 className="font-bold">Public page</h2>
            <p className="mb-3 text-sm text-slate-500">Lists their open trips{info.roster ? " (registered riders only can book)" : ""}.</p>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-1.5 pl-3 text-sm ring-1 ring-slate-200/70">
              <a href={publicUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand hover:underline">
                {publicUrl.replace(/^https?:\/\//, "")}
              </a>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="p-1.5 text-slate-400 hover:text-ink" aria-label="Open">
                <ExternalLink className="size-4" />
              </a>
              <CopyButton text={publicUrl} label="Copy" className="btn-ghost !px-3 !py-1.5" />
            </div>
          </section>
          <section className="card">
            <h2 className="mb-2 font-bold">Their admins</h2>
            <ul className="mb-4 divide-y divide-slate-100">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{a.name}</div>
                    <div className="truncate text-sm text-slate-500">{a.email}</div>
                  </div>
                  <ConfirmButton action={removeAdmin.bind(null, a.id)} confirm={`Remove ${a.name}?`} className="p-2 text-slate-400 hover:text-red-600" title="Remove">
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </li>
              ))}
              {admins.length === 0 && <li className="py-2 text-sm text-slate-500">No admins yet: add one so they can sign in.</li>}
            </ul>
            <p className="mb-2 text-xs text-slate-500">To add an admin here, open their dashboard and use Team, or:</p>
            <form action={openOrg.bind(null, id)}>
              <button className="btn-ghost w-full">Open dashboard → Team</button>
            </form>
          </section>
          <section className="card border-red-100">
            <h2 className="font-bold text-red-700">Delete organisation</h2>
            <p className="mb-3 text-sm text-slate-500">
              Deletes {org.name} and everything in it: {trips} trips with their bookings, vehicles{info.roster ? `, ${riders} ${info.riders}` : ""} and admins. This can&apos;t be undone. To pause them instead, use Switch off.
            </p>
            <ConfirmButton
              action={deleteOrg.bind(null, id)}
              confirm={`Delete ${org.name} and ALL its trips, bookings${info.roster ? `, ${info.riders}` : ""} and admins? This can't be undone.`}
              className="btn-danger"
            >
              <Trash2 className="size-4" /> Delete {org.name}
            </ConfirmButton>
          </section>
        </div>
      </div>
    </>
  );
}
