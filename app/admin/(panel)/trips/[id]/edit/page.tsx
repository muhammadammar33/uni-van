import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TripForm } from "@/components/admin/TripForm";
import { adminTrip } from "@/lib/adminData";
import { updateTrip } from "../../../../actions";

export const metadata = { title: "Edit trip" };

export default async function EditTripPage({ params }: PageProps<"/admin/trips/[id]/edit">) {
  const { id, trip, org, stops } = await adminTrip((await params).id);
  return (
    <>
      <Link href={`/admin/trips/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Back to trip
      </Link>
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl">Edit trip</h1>
      <TripForm
        action={updateTrip.bind(null, id)}
        submitLabel="Save changes"
        orgType={org.type}
        initial={{
          title: trip.title,
          direction: trip.direction,
          date: trip.date,
          endDate: trip.endDate ?? "",
          genderRule: trip.genderRule,
          maxSeats: trip.maxSeats,
          membersOnly: trip.membersOnly,
          departTime: trip.departTime ?? "",
          closesAt: trip.closesAt ?? "",
          notes: trip.notes ?? "",
          fare: trip.fare === null ? "" : String(trip.fare),
          stops: stops.map((s) => ({ id: s.id, name: s.name, time: s.time })),
        }}
      />
    </>
  );
}
