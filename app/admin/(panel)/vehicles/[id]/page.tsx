import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { LayoutEditor } from "@/components/admin/LayoutEditor";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { requireDb, schema as s } from "@/lib/db";
import { deleteVehicle, saveVehicle } from "../../../actions";

export const metadata = { title: "Vehicle" };

export default async function VehiclePage({ params }: PageProps<"/admin/vehicles/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [vehicle] = await requireDb().select().from(s.vehicles).where(eq(s.vehicles.id, id));
  if (!vehicle) notFound();
  return (
    <>
      <Link href="/admin/vehicles" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Vehicles
      </Link>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{vehicle.name}</h1>
        <ConfirmButton action={deleteVehicle.bind(null, id)} confirm={`Delete "${vehicle.name}"? Trips already using it keep their seating.`} className="btn-danger">
          Delete
        </ConfirmButton>
      </div>
      <p className="mb-5 text-sm text-slate-600">Editing a vehicle changes new trips only. Existing trips keep their own copy.</p>
      <LayoutEditor initial={vehicle.layout} name={vehicle.name} onSave={saveVehicle.bind(null, id)} />
    </>
  );
}
