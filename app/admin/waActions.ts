"use server";

import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { subscribeWaba } from "@/lib/waSetup";
import { saveWabaId } from "@/lib/waInbox";

export async function connectWaba(fd: FormData) {
  await requireSuper();
  const id = String(fd.get("waba") ?? "").trim();
  const r = await subscribeWaba(id);
  if (r.ok) await saveWabaId(id);
  redirect(`/admin/whatsapp/setup?waba=${encodeURIComponent(id)}&${r.ok ? "connected=1" : `error=${encodeURIComponent(r.error)}`}`);
}
