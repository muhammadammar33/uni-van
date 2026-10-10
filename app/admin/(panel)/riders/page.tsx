import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { Download, Pencil, Search, Trash2, UserCheck, UserX } from "lucide-react";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { RiderForm, RiderImport } from "@/components/admin/RiderForms";
import { GenderIcon } from "@/components/SeatMap";
import { requireOrg } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { displayPhone } from "@/lib/format";
import { orgInfo } from "@/lib/orgTypes";
import { deleteRider, setRiderActive } from "../../actions";

export const metadata = { title: "Riders" };

const PAGE = 100;

export default async function RidersPage({ searchParams }: PageProps<"/admin/riders">) {
  const { org } = await requireOrg();
  const info = orgInfo(org.type);
  if (!info.roster) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const editId = Number(sp.edit) || null;
  const tab = sp.tab === "import" ? "import" : sp.tab === "add" || editId ? "add" : null;

  const db = requireDb();
  const digits = q.replace(/\D/g, "");
  const filter = and(
    eq(s.riders.orgId, org.id),
    q
      ? or(
          ilike(s.riders.name, `%${q}%`),
          ilike(s.riders.refNo, `%${q}%`),
          ilike(s.riders.groupName, `%${q}%`),
          ilike(s.riders.stop, `%${q}%`),
          digits.length >= 4 ? ilike(s.riders.phone, `%${digits.replace(/^0/, "")}%`) : undefined,
        )
      : undefined,
  );
  const [riders, [{ total }], stats, editing] = await Promise.all([
    db
      .select({
        rider: s.riders,
        trips: sql<number>`(select count(*)::int from ${s.bookings} where ${s.bookings.riderId} = ${s.riders.id})`,
      })
      .from(s.riders)
      .where(filter)
      .orderBy(asc(s.riders.name))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ total: count() }).from(s.riders).where(filter),
    db
      .select({ gender: s.riders.gender, active: s.riders.active, n: count() })
      .from(s.riders)
      .where(eq(s.riders.orgId, org.id))
      .groupBy(s.riders.gender, s.riders.active),
    editId ? db.select().from(s.riders).where(and(eq(s.riders.id, editId), eq(s.riders.orgId, org.id))) : Promise.resolve([]),
  ]);
  const sum = (f: (r: (typeof stats)[number]) => boolean) => stats.filter(f).reduce((a, r) => a + r.n, 0);
  const all = sum(() => true);
  const labels = { rider: info.rider, riders: info.riders, refLabel: info.refLabel, groupLabel: info.groupLabel };
  const Title = info.riders.replace(/^./, (c) => c.toUpperCase());
  const edit = editing[0];
  const href = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: q || undefined, ...p })) if (v !== undefined && v !== "") u.set(k, String(v));
    const str = u.toString();
    return `/admin/riders${str ? `?${str}` : ""}`;
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{Title}</h1>
          <p className="text-sm text-slate-500">
            Your registered {info.riders}. On trips marked &ldquo;registered {info.riders} only&rdquo;, only they can book, with the name and gender on this list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={tab === "import" ? href({}) : href({ tab: "import" })} className="btn-primary">
            Import Excel / CSV
          </Link>
          <Link href={tab === "add" ? href({}) : href({ tab: "add" })} className="btn-ghost">
            Add one
          </Link>
          {all > 0 && (
            <a href="/admin/riders/export.csv" className="btn-ghost">
              <Download className="size-4" /> Export
            </a>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={`All ${info.riders}`} value={all} />
        <Stat label="Female" value={sum((r) => r.gender === "female" && r.active)} tone="text-female" />
        <Stat label="Male" value={sum((r) => r.gender === "male" && r.active)} tone="text-male" />
        <Stat label="Switched off" value={sum((r) => !r.active)} />
      </div>

      {tab === "import" && (
        <section className="card mb-5">
          <h2 className="mb-3 font-bold">Import from Excel or CSV</h2>
          <RiderImport labels={labels} />
        </section>
      )}
      {tab === "add" && (
        <section className="card mb-5">
          <h2 className="mb-3 font-bold">{edit ? `Edit ${edit.name}` : `Add a ${info.rider}`}</h2>
          <RiderForm
            key={edit?.id ?? "new"}
            labels={labels}
            initial={
              edit
                ? {
                    id: edit.id,
                    name: edit.name,
                    phone: displayPhone(edit.phone),
                    gender: edit.gender,
                    refNo: edit.refNo ?? "",
                    groupName: edit.groupName ?? "",
                    stop: edit.stop ?? "",
                  }
                : undefined
            }
          />
        </section>
      )}

      <form className="mb-3 flex gap-2" action="/admin/riders">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} placeholder={`Search name, phone, ${info.refLabel.toLowerCase()}, ${info.groupLabel.toLowerCase()}…`} className="input !pl-9" />
        </div>
        <button className="btn-ghost">Search</button>
      </form>

      {all === 0 ? (
        <div className="card text-center text-slate-600">
          No {info.riders} yet. <b>Import Excel / CSV</b> to add your whole list at once, or <b>Add one</b> at a time.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
          <ul className="divide-y divide-slate-100">
            {riders.map(({ rider: r, trips }) => (
              <li key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${r.active ? "" : "opacity-50"}`}>
                <GenderIcon gender={r.gender} className={`size-4 shrink-0 ${r.gender === "female" ? "text-female" : "text-male"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">
                    {r.name} {!r.active && <span className="text-xs font-normal text-slate-500">(switched off)</span>}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {[displayPhone(r.phone), r.refNo, r.groupName, r.stop].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="text-xs text-slate-400" title="Seats booked so far">
                  {trips} {trips === 1 ? "trip" : "trips"}
                </span>
                <div className="flex">
                  <Link href={href({ edit: r.id })} className="p-1.5 text-slate-400 hover:text-ink" aria-label={`Edit ${r.name}`}>
                    <Pencil className="size-4" />
                  </Link>
                  <ConfirmButton
                    action={setRiderActive.bind(null, r.id, !r.active)}
                    className="p-1.5 text-slate-400 hover:text-ink"
                    title={r.active ? "Switch off (can't book)" : "Switch on"}
                  >
                    {r.active ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                  </ConfirmButton>
                  <ConfirmButton action={deleteRider.bind(null, r.id)} confirm={`Delete ${r.name} from the list?`} className="p-1.5 text-slate-400 hover:text-red-600" title="Delete">
                    <Trash2 className="size-4" />
                  </ConfirmButton>
                </div>
              </li>
            ))}
            {riders.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Nobody matches &ldquo;{q}&rdquo;.</li>}
          </ul>
        </div>
      )}
      {total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="btn-ghost !py-1.5">
                Previous
              </Link>
            )}
            {page * PAGE < total && (
              <Link href={href({ page: page + 1 })} className="btn-ghost !py-1.5">
                Next
              </Link>
            )}
          </span>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="card !p-4">
      <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}
