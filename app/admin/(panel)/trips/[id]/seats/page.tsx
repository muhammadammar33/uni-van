import Link from "next/link";
import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { LayoutEditor } from "@/components/admin/LayoutEditor";
import { requireDb, schema as s } from "@/lib/db";
import { loadTrip, takenSeats } from "@/lib/trips";
import { saveTripLayout } from "../../../../actions";

export const metadata = { title: "Trip seating" };

export default async function TripSeatsPage({ params }: PageProps<"/admin/trips/[id]/seats">) {
  const id = Number((await params).id);
  const data = Number.isInteger(id) ? await loadTrip({ id }) : null;
  if (!data) notFound();
  const vehicles = await requireDb().select().from(s.vehicles).orderBy(asc(s.vehicles.id));
  return (
    <>
      <Link href={`/admin/trips/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Back to trip
      </Link>
      <h1 className="mb-1 text-2xl font-bold">Seating for this trip</h1>
      <p className="mb-5 text-sm text-slate-600">
        Changes here apply to <b>{data.trip.title}</b> only. To change the plan for future trips, edit the vehicle under Vehicles.
      </p>
      <LayoutEditor
        initial={data.trip.layout}
        booked={takenSeats(data.bookings)}
        presets={vehicles.map((v) => ({ name: v.name, layout: v.layout }))}
        onSave={saveTripLayout.bind(null, id)}
      />
    </>
  );
}
