import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireOrg } from "@/lib/auth";
import { LayoutEditor } from "@/components/admin/LayoutEditor";
import { busLayout, hiaceLayout } from "@/lib/layout";
import { saveVehicle } from "../../../actions";

export const metadata = { title: "New vehicle" };

export default async function NewVehiclePage() {
  await requireOrg();
  return (
    <>
      <Link href="/admin/vehicles" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="size-4" /> Vehicles
      </Link>
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl">New vehicle</h1>
      <LayoutEditor
        initial={hiaceLayout()}
        name=""
        presets={[
          { name: "Toyota Hiace (15 seats)", layout: hiaceLayout() },
          { name: "Coaster bus (29 seats)", layout: busLayout(6) },
        ]}
        onSave={saveVehicle.bind(null, null)}
      />
    </>
  );
}
