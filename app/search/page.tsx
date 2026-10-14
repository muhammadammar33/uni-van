import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Car } from "lucide-react";
import { RideCard } from "@/components/carpool/RideCard";
import { SearchBox } from "@/components/carpool/SearchBox";
import { SearchMap } from "@/components/carpool/SearchMap";
import { Logo } from "@/components/Logo";
import { formatDate } from "@/lib/format";
import { decodePoint, encodePoint } from "@/lib/places";
import { searchRides } from "@/lib/rides";
import { kindFor } from "@/lib/cities";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Find a ride" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const from = decodePoint(str("from"));
  const to = decodePoint(str("to"));
  const date = str("date") && /^\d{4}-\d{2}-\d{2}$/.test(str("date")!) ? str("date")! : null;
  const kind = kindFor(str("kind"), from, to);
  const rides = await searchRides(from, to, date, kind);
  const keep = (r: { pickupIdx: number; dropIdx: number }) => {
    const q = new URLSearchParams();
    if (date) q.set("date", date);
    q.set("p", String(r.pickupIdx));
    q.set("d", String(r.dropIdx));
    if (from) q.set("from", encodePoint(from));
    if (kind === "intercity") q.set("kind", kind);
    return q.toString();
  };

  return (
    <div className="min-h-dvh">
      <header className="bg-hero px-4 pb-6 pt-4 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/" aria-label="Home">
            <Logo light />
          </Link>
          <Link href="/offer" className="ml-auto rounded-xl bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/20">
            Offer a ride
          </Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <SearchBox key={`${str("from")}|${str("to")}|${date}|${kind}`} from={from} to={to} date={date ?? ""} kind={kind} />
        </div>
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink lg:hidden">
            <ArrowLeft className="size-4" /> Home
          </Link>
          <h1 className="text-xl font-extrabold tracking-tight">
            {rides.length} {rides.length === 1 ? "ride" : "rides"}
            {from && to ? (
              <span className="font-semibold text-slate-500">
                {" "}
                from {from.name} to {to.name}
              </span>
            ) : from ? (
              <span className="font-semibold text-slate-500"> from {from.name}</span>
            ) : to ? (
              <span className="font-semibold text-slate-500"> to {to.name}</span>
            ) : null}
            {date && <span className="font-semibold text-slate-500"> · {formatDate(date)}</span>}
            {kind === "intercity" && <span className="font-semibold text-slate-500"> · between cities</span>}
          </h1>
          {(from || to) && <SearchMap from={from} to={to} routes={rides.slice(0, 8).map((r) => ({ points: r.points, highlight: [r.pickupIdx, r.dropIdx] as [number, number] }))} />}
          {rides.length ? (
            <ul className="space-y-3">
              {rides.map((r) => (
                <li key={r.slug}>
                  <RideCard ride={r} pickupIdx={r.pickupIdx} dropIdx={r.dropIdx} pickupKm={from ? r.pickupKm : undefined} href={`/r/${r.slug}?${keep(r)}`} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="card text-center">
              <Car className="mx-auto size-10 text-slate-300" />
              <p className="mt-2 font-semibold">No rides on this route {date ? "that day" : "yet"}.</p>
              <p className="mt-1 text-sm text-slate-600">Try another day, a nearby pickup point, or check back later: new rides are added all the time.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
