import Link from "next/link";
import { AlertTriangle, Car, ChevronRight, Search, User } from "lucide-react";
import { PushOptIn } from "@/components/admin/PushOptIn";
import { requireSuper } from "@/lib/auth";
import { displayPhone } from "@/lib/format";
import { pendingCount, reviewQueue, searchIdentities } from "@/lib/identity";
import { formatIdNumber } from "@/lib/identityRules";
import type { Identity } from "@/lib/db/schema";

export const metadata = { title: "Verifications" };

const STATUS_STYLE = { none: "", pending: "bg-amber-100 text-amber-800", approved: "bg-emerald-100 text-emerald-800", rejected: "bg-red-100 text-red-800" } as const;

/** Hours left of the 24-hour promise (negative = late). */
const hoursLeft = (i: Identity) => Math.round((i.submittedAt.getTime() + 24 * 3600_000 - Date.now()) / 3600_000);

/** Super admin: IDs waiting for review (oldest first), and a search to look anyone up. */
export default async function VerificationsPage({ searchParams }: PageProps<"/admin/verifications">) {
  await requireSuper();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const show = sp.show === "approved" || sp.show === "rejected" || sp.show === "all" ? sp.show : "pending";
  const [rows, waiting] = await Promise.all([q ? searchIdentities(q) : reviewQueue(show), pendingCount()]);
  const tab = (k: string, label: string) => (
    <Link key={k} href={`/admin/verifications?show=${k}`} className={`rounded-lg px-2.5 py-1 ${!q && show === k ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>
      {label}
    </Link>
  );
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Verifications</h1>
      <p className="mb-4 text-sm text-slate-500">Drivers&apos; and riders&apos; IDs. People are told it takes up to 24 hours: check them before the timer runs out.</p>
      {sp.deleted && <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">ID data deleted.</p>}
      <div className="mb-4">
        <PushOptIn />
      </div>
      <form className="mb-3 flex gap-2" action="/admin/verifications">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} className="input !pl-9" placeholder="Search CNIC, phone or name (e.g. after an incident)" aria-label="Search people" />
        </div>
        <button className="btn-primary">Search</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-1 text-sm">
        {tab("pending", `Waiting (${waiting})`)}
        {tab("approved", "Approved")}
        {tab("rejected", "Turned down")}
        {tab("all", "All")}
        {q && <span className="px-2.5 py-1 font-semibold">Results for “{q}”</span>}
      </div>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        {rows.map((i) => {
          const left = hoursLeft(i);
          const waitingNow = i.riderStatus === "pending" || i.driverStatus === "pending";
          return (
            <li key={i.id}>
              <Link href={`/admin/verifications/${i.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${i.driverStatus !== "none" ? "bg-brand-lt text-brand" : "bg-slate-100 text-slate-500"}`}>
                  {i.driverStatus !== "none" ? <Car className="size-4" /> : <User className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {i.fullName}
                    {i.idType === "bform" && <span className="rounded-full bg-slate-100 px-2 text-xs">Under 18</span>}
                    {i.warnings.length > 0 && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                        <AlertTriangle className="size-3" /> {i.warnings.length}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {formatIdNumber(i.idNumber)} · {displayPhone(i.phone)}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1 text-xs">
                    {i.riderStatus !== "none" && <span className={`rounded-full px-2 font-semibold ${STATUS_STYLE[i.riderStatus]}`}>Rider: {i.riderStatus}</span>}
                    {i.driverStatus !== "none" && <span className={`rounded-full px-2 font-semibold ${STATUS_STYLE[i.driverStatus]}`}>Driver: {i.driverStatus}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-xs">
                  {waitingNow && <span className={left < 0 ? "font-bold text-red-600" : left < 6 ? "font-semibold text-amber-700" : "text-slate-400"}>{left < 0 ? `${-left}h late` : `${left}h left`}</span>}
                </span>
                <ChevronRight className="size-4 shrink-0 text-slate-300" />
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-8 text-center text-slate-500">{q ? "Nobody found." : show === "pending" ? "Nothing waiting. 🎉" : "Nothing here yet."}</li>}
      </ul>
    </>
  );
}
