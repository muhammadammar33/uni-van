import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TripForm } from "@/components/admin/TripForm";
import { loadTrip } from "@/lib/trips";
import { updateTrip } from "../../../../actions";

export const metadata = { title: "Edit trip" };

export default async function EditTripPage({ params }: PageProps<"/admin/trips/[id]/edit">) {
  const id = Number((await params).id);
  const data = Number.isInteger(id) ? await loadTrip({ id }) : null;
  if (!data) notFound();
  const { trip, stops } = data;
  return (
    <>
      <Link href={`/admin/trips/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Back to trip
      </Link>
      <h1 className="mb-5 text-2xl font-bold">Edit trip</h1>
      <TripForm
        action={updateTrip.bind(null, id)}
        submitLabel="Save changes"
        initial={{
          title: trip.title,
          direction: trip.direction,
          date: trip.date,
          departTime: trip.departTime ?? "",
          closesAt: trip.closesAt ?? "",
          notes: trip.notes ?? "",
          stops: stops.map((s) => ({ id: s.id, name: s.name, time: s.time })),
        }}
      />
    </>
  );
}
