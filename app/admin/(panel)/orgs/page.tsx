import Link from "next/link";
import { asc, count, eq, gte, sql } from "drizzle-orm";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { AddSuperAdminForm, CreateOrgForm } from "@/components/admin/OrgForms";
import { requireSuper } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { todayLocal } from "@/lib/format";
import { ORG_TYPE_INFO, ORG_TYPES } from "@/lib/orgTypes";
import { openOrg, removeAdmin } from "../../actions";

export const metadata = { title: "Organisations" };

export default async function OrgsPage({ searchParams }: PageProps<"/admin/orgs">) {
  const me = await requireSuper();
  const db = requireDb();
  const creating = (await searchParams).new !== undefined;
  const today = todayLocal();
  const [orgs, tripCounts, riderCounts, bookingCounts, supers] = await Promise.all([
    db.select().from(s.organizations).orderBy(asc(s.organizations.name)),
    db.select({ orgId: s.trips.orgId, n: count() }).from(s.trips).where(gte(s.trips.date, today)).groupBy(s.trips.orgId),
    db.select({ orgId: s.riders.orgId, n: count() }).from(s.riders).groupBy(s.riders.orgId),
    db
      .select({ orgId: s.trips.orgId, n: count() })
      .from(s.bookings)
      .innerJoin(s.trips, eq(s.trips.id, s.bookings.tripId))
      .where(sql`${s.bookings.createdAt} > now() - interval '30 days'`)
      .groupBy(s.trips.orgId),
    db.select({ id: s.admins.id, name: s.admins.name, email: s.admins.email }).from(s.admins).where(eq(s.admins.role, "super")).orderBy(asc(s.admins.id)),
  ]);
  const n = (rows: { orgId: number; n: number }[], id: number) => rows.find((r) => r.orgId === id)?.n ?? 0;
  const totalBookings = bookingCounts.reduce((a, r) => a + r.n, 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand">Hamsafar platform</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Organisations</h1>
        </div>
        <Link href={creating ? "/admin/orgs" : "/admin/orgs?new"} className="btn-primary px-5 py-3">
          <Plus className="size-4" /> {creating ? "Close" : "New organisation"}
        </Link>
      </div>

      {creating && (
        <div className="mb-8">
          <CreateOrgForm />
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Organisations" value={orgs.filter((o) => o.active).length} />
        <Stat label="Upcoming trips" value={tripCounts.reduce((a, r) => a + r.n, 0)} />
        <Stat label="Bookings, 30 days" value={totalBookings} />
        <Stat label="Registered riders" value={riderCounts.reduce((a, r) => a + r.n, 0)} />
      </div>

      {ORG_TYPES.map((type) => {
        const list = orgs.filter((o) => o.type === type);
        if (!list.length) return null;
        return (
          <section key={type} className="mb-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
              {ORG_TYPE_INFO[type].emoji} {ORG_TYPE_INFO[type].label}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
              {list.map((o) => (
                <li key={o.id} className={`card flex min-w-0 items-center gap-3 !p-4 ${o.active ? "" : "opacity-60"}`}>
                  <Link href={`/admin/orgs/${o.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold">{o.name}</span>
                      {!o.active && <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">Off</span>}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-500">
                      {[o.city, `${n(tripCounts, o.id)} upcoming trips`, `${n(bookingCounts, o.id)} bookings / 30 days`, ORG_TYPE_INFO[o.type].roster ? `${n(riderCounts, o.id)} ${ORG_TYPE_INFO[o.type].riders}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </Link>
                  <form action={openOrg.bind(null, o.id)}>
                    <button className="btn-ghost !px-3 !py-2" title="Open their dashboard">
                      Open <ChevronRight className="size-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {orgs.length === 0 && <p className="card text-center text-slate-600">No organisations yet. Create the first one above.</p>}

      <section className="card mt-10">
        <h2 className="font-bold">Super admins</h2>
        <p className="mb-3 text-sm text-slate-500">People who run Hamsafar itself: they see and manage every organisation.</p>
        <ul className="mb-4 divide-y divide-slate-100">
          {supers.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {a.name} {a.id === me.id && <span className="text-xs text-slate-400">(you)</span>}
                </div>
                <div className="truncate text-sm text-slate-500">{a.email}</div>
              </div>
              {a.id !== me.id && (
                <ConfirmButton action={removeAdmin.bind(null, a.id)} confirm={`Remove ${a.name} as super admin?`} className="p-2 text-slate-400 hover:text-red-600" title="Remove">
                  <Trash2 className="size-4" />
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
        <AddSuperAdminForm />
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card !p-4">
      <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}
