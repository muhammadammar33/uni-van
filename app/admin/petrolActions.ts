"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { refreshPetrolPrice, savePetrolPrice } from "@/lib/petrol";

/** A super admin enters today's price from OGRA's notice. */
export async function setPetrolPrice(fd: FormData) {
  await requireSuper();
  const out = await savePetrolPrice(Number(String(fd.get("price") ?? "").replace(/[^\d.]/g, "")), String(fd.get("effective") ?? ""), "manual");
  revalidatePath("/admin/petrol");
  redirect(`/admin/petrol?${out.ok ? "saved=1" : `error=${encodeURIComponent(out.note ?? "Couldn't save")}`}`);
}

/** Try reading OGRA from the server now (works only if OGRA's firewall lets it through). */
export async function tryOgraNow() {
  await requireSuper();
  const out = await refreshPetrolPrice();
  revalidatePath("/admin/petrol");
  redirect(`/admin/petrol?${out.ok ? "saved=1" : `error=${encodeURIComponent(out.note ?? "Couldn't read OGRA")}`}`);
}
