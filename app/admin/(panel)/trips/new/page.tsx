import { asc, eq } from "drizzle-orm";
import { TripForm } from "@/components/admin/TripForm";
import { requireOrg } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";
import { orgInfo } from "@/lib/orgTypes";
import { todayLocal } from "@/lib/format";
import { seatList } from "@/lib/layout";
import { createTrip } from "../../../actions";

export const metadata = { title: "New trip" };

export default async function NewTripPage() {
  const { org } = await requireOrg();
  const vehicles = await requireDb().select().from(s.vehicles).where(eq(s.vehicles.orgId, org.id)).orderBy(asc(s.vehicles.id));
  const d = orgInfo(org.type).defaults;
  return (
    <>
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl">New trip</h1>
      {vehicles.length === 0 ? (
        <p className="card">Add a vehicle first under Vehicles.</p>
      ) : (
        <TripForm
          action={createTrip}
          submitLabel="Create trip"
          orgType={org.type}
          vehicles={vehicles.map((v) => ({ id: v.id, name: v.name, seats: seatList(v.layout).length }))}
          initial={{
            title: "",
            direction: "to_uni",
            date: todayLocal(),
            endDate: "",
            ...d,
            departTime: "",
            closesAt: "",
            notes: "",
            fare: "",
            stops: [],
          }}
        />
      )}
    </>
  );
}
