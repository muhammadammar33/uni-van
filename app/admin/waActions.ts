"use server";

import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { subscribeWaba } from "@/lib/waSetup";

export async function connectWaba(fd: FormData) {
  await requireSuper();
  const id = String(fd.get("waba") ?? "").trim();
  const r = await subscribeWaba(id);
  redirect(`/admin/whatsapp/setup?waba=${encodeURIComponent(id)}&${r.ok ? "connected=1" : `error=${encodeURIComponent(r.error)}`}`);
}
