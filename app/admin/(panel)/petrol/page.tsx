import { ExternalLink, Fuel, RefreshCw } from "lucide-react";
import { setPetrolPrice, tryOgraNow } from "@/app/admin/petrolActions";
import { requireSuper } from "@/lib/auth";
import { fareGuide } from "@/lib/fare";
import { formatDate, todayLocal } from "@/lib/format";
import { currentPetrolPrice, lastPetrolTry } from "@/lib/petrol";

export const metadata = { title: "Petrol price" };

const SOURCE = { ogra: "Read from OGRA automatically", manual: "Entered by an admin", default: "Default (not set yet)" } as const;

/** Super admin: today's petrol price, used for the fare suggestion and the fare cap. */
export default async function PetrolPage({ searchParams }: PageProps<"/admin/petrol">) {
  await requireSuper();
  const sp = await searchParams;
  const [p, last] = await Promise.all([currentPetrolPrice(), lastPetrolTry()]);
  // An example route so the effect of the price is visible: Saddar (Rawalpindi) to F-6 Markaz.
  const example = fareGuide([{ lat: 33.5973, lng: 73.0479 }, { lat: 33.7294, lng: 73.0771 }], p.price);
  const old = p.effective ? p.effective < todayLocal() : true;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Petrol price</h1>
      <p className="mb-5 text-sm text-slate-500">Used for the suggested fare per seat and the highest fare drivers can ask.</p>
      {sp.saved && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Saved. New fare suggestions use it now.</p>}
      {typeof sp.error === "string" && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{sp.error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="flex items-center gap-2 font-bold">
            <Fuel className="size-5 text-brand" /> Now
          </h2>
          <p className="text-4xl font-extrabold text-brand">Rs. {p.price}<span className="text-base font-semibold text-slate-500"> / litre</span></p>
          <p className={`text-sm ${old ? "font-semibold text-amber-700" : "text-slate-600"}`}>
            {p.effective ? `Effective ${formatDate(p.effective, true)}` : "No date"} · {SOURCE[p.source]}
            {old && " · check today’s notice"}
          </p>
          <p className="text-sm text-slate-600">
            Example, Saddar → F-6 (about {example.km} km): suggested <b>Rs. {example.suggested}</b> a seat, at most Rs. {example.max}.
          </p>
          {last && !last.ok && <p className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500">Last automatic reading ({formatDate(last.at.slice(0, 10))}): {last.note}</p>}
        </section>
        <section className="card space-y-3">
          <h2 className="font-bold">Update from OGRA’s notice</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Open{" "}
              <a href="https://www.ogra.org.pk/price-publications" target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                OGRA price publications <ExternalLink className="inline size-3.5" />
              </a>{" "}
              and the newest “Price Publications Effective Dated …” (EN).
            </li>
            <li>Copy <b>Total Petrol Price</b> (Rs./litre) and its date here.</li>
          </ol>
          <form action={setPetrolPrice} className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="label">Rs. a litre</span>
              <input name="price" inputMode="decimal" required className="input" placeholder={String(p.price)} />
            </label>
            <label className="text-sm">
              <span className="label">Effective date</span>
              <input name="effective" type="date" required className="input" defaultValue={todayLocal()} />
            </label>
            <button className="btn-primary col-span-2">Save price</button>
          </form>
          <form action={tryOgraNow}>
            <button className="btn-ghost w-full text-sm">
              <RefreshCw className="size-4" /> Try reading OGRA automatically
            </button>
          </form>
          <p className="text-xs text-slate-500">OGRA’s website usually refuses servers (including ours), so automatic reading may fail; entering it here takes a minute.</p>
        </section>
      </div>
    </>
  );
}
