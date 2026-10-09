import { asc } from "drizzle-orm";
import { TripForm } from "@/components/admin/TripForm";
import { requireDb, schema as s } from "@/lib/db";
import { todayLocal } from "@/lib/format";
import { seatList } from "@/lib/layout";
import { createTrip } from "../../../actions";

export const metadata = { title: "New trip" };

export default async function NewTripPage() {
  const vehicles = await requireDb().select().from(s.vehicles).orderBy(asc(s.vehicles.id));
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">New trip</h1>
      {vehicles.length === 0 ? (
        <p className="card">Add a vehicle first under Vehicles.</p>
      ) : (
        <TripForm
          action={createTrip}
          submitLabel="Create trip"
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, seats: seatList(v.layout).length }))}
          initial={{ title: "", direction: "to_uni", date: todayLocal(), departTime: "", closesAt: "", notes: "", fare: "", stops: [] }}
        />
      )}
    </>
  );
}
