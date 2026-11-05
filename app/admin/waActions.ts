"use server";

import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { subscribeWaba } from "@/lib/waSetup";
import { chooseWabaForTemplates, saveWabaId } from "@/lib/waInbox";

export async function connectWaba(fd: FormData) {
  await requireSuper();
  const id = String(fd.get("waba") ?? "").trim();
  const r = await subscribeWaba(id);
  if (r.ok) await saveWabaId(id);
  redirect(`/admin/whatsapp/setup?waba=${encodeURIComponent(id)}&${r.ok ? "connected=1" : `error=${encodeURIComponent(r.error)}`}`);
}

/** From a chat: use this WhatsApp Business Account's templates to start chats. */
export async function chooseTemplatesAccount(fd: FormData) {
  await requireSuper();
  const back = String(fd.get("back") ?? "/admin/whatsapp");
  const err = await chooseWabaForTemplates(String(fd.get("waba") ?? ""));
  redirect(`${/^\/admin\/whatsapp\/\d{8,15}$/.test(back) ? back : "/admin/whatsapp"}${err ? `?waba_error=${encodeURIComponent(err)}` : ""}`);
}
