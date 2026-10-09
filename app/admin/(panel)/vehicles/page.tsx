import Link from "next/link";
import { asc } from "drizzle-orm";
import { ChevronRight, Plus } from "lucide-react";
import { requireDb, schema as s } from "@/lib/db";
import { MiniLayout } from "@/components/MiniLayout";
import { seatList } from "@/lib/layout";

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage() {
  const vehicles = await requireDb().select().from(s.vehicles).orderBy(asc(s.vehicles.id));
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Vehicles</h1>
        <Link href="/admin/vehicles/new" className="btn-primary">
          <Plus className="size-4" /> New vehicle
        </Link>
      </div>
      <p className="mb-5 text-sm text-slate-600">Saved seating plans. A new trip copies the plan of the vehicle you choose.</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {vehicles.map((v) => {
          const seats = seatList(v.layout);
          const count = (g: string) => seats.filter((x) => x.gender === g).length;
          return (
            <li key={v.id}>
              <Link href={`/admin/vehicles/${v.id}`} className="card flex items-center gap-4 !p-4 transition hover:shadow-lift">
                <MiniLayout layout={v.layout} />
                <div className="flex-1">
                  <div className="text-lg font-bold">{v.name}</div>
                  <div className="text-sm text-slate-500">
                    {seats.length} seats · <span className="text-female">{count("female")} female</span> · <span className="text-male">{count("male")} male</span> ·{" "}
                    {count("any")} anyone
                  </div>
                </div>
                <ChevronRight className="size-5 text-slate-400" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
