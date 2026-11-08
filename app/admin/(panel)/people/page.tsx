import Link from "next/link";
import { Ban, ChevronRight, Search } from "lucide-react";
import { requireSuper } from "@/lib/auth";
import { displayPhone } from "@/lib/format";
import { listPeople } from "@/lib/people";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi";
const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });

/** Super admin: everyone who signed in with Google, to find someone and block them if needed. */
export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  await requireSuper();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const show = sp.show === "blocked" ? "blocked" : "all";
  const people = await listPeople(q, show);
  const tab = (k: "all" | "blocked", label: string) => (
    <Link href={`/admin/people${k === "blocked" ? "?show=blocked" : ""}`} className={`rounded-lg px-2.5 py-1 ${show === k && !q ? "bg-ink text-white" : "text-slate-500 hover:text-ink"}`}>
      {label}
    </Link>
  );
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">People</h1>
      {sp.deleted && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Account deleted.</p>}
      <p className="mt-1 text-sm text-slate-600">Riders and drivers who signed in with Google. Open someone to see their rides and bookings, or to block them.</p>
      <form className="mt-4 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={q} className="input !pl-9" placeholder="Name, email or phone" aria-label="Search people" />
        </div>
        <button className="btn-primary shrink-0">Search</button>
      </form>
      <div className="mt-3 flex gap-1 text-sm font-semibold">
        {tab("all", "Everyone")}
        {tab("blocked", "Blocked")}
      </div>
      <ul className="card mt-3 divide-y divide-slate-100 !p-0">
        {people.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{q ? "Nobody found." : show === "blocked" ? "Nobody is blocked." : "Nobody has signed in yet."}</li>}
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/people/${p.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 font-bold text-slate-500">
                {p.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Google profile picture
                  <img src={p.picture} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
                ) : (
                  p.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{p.name}</span>
                  {p.blockedAt && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 text-xs font-bold text-red-700">
                      <Ban className="size-3" /> Blocked
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {p.email}
                  {p.phone && ` · ${displayPhone(p.phone)}`}
                </span>
                <span className="block text-xs text-slate-400">
                  Joined {day(p.createdAt)} · {p.rides} ride{p.rides === 1 ? "" : "s"} · {p.bookings} booking{p.bookings === 1 ? "" : "s"}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
