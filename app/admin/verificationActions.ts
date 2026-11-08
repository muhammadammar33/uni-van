"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { approveIdentity, deleteIdentity, rejectIdentity } from "@/lib/identity";
import { sendTemplate, waConfig } from "@/lib/whatsapp";
import { logError } from "@/lib/api";
import { pushLater } from "@/lib/push";

const idOf = (fd: FormData) => Number(fd.get("id")) || 0;

/** Optional WhatsApp note to the person (needs an approved "Utility" template with {{1}} = first name). */
async function tellPerson(phone: string, template: string | undefined, name: string) {
  if (template && waConfig().canSend) await sendTemplate(phone, template, [name.split(" ")[0]]).catch((err) => logError("WhatsApp notice failed", err));
}

export async function approveId(fd: FormData) {
  const admin = await requireSuper();
  const r = await approveIdentity(idOf(fd), admin.id);
  await tellPerson(r.phone, process.env.WHATSAPP_APPROVED_TEMPLATE?.trim(), r.name);
  pushLater([r.phone], {
    title: "Your ID is approved",
    body: r.driver ? (r.ridesLive ? "Your rides are live now: riders can book them." : "You can now offer rides and book seats.") : "You can now book any ride, including women-only and men-only rides.",
    url: "/me",
  });
  revalidatePath("/admin/verifications");
  redirect(`/admin/verifications/${idOf(fd)}?approved=${r.ridesLive}`);
}

export async function rejectId(fd: FormData) {
  const admin = await requireSuper();
  const rej = await rejectIdentity(idOf(fd), admin.id, String(fd.get("reason") ?? ""));
  pushLater([rej.phone], { title: "Your ID check needs another try", body: `${rej.reason}. Please send your ID again.`, url: "/welcome" });
  revalidatePath("/admin/verifications");
  redirect(`/admin/verifications/${idOf(fd)}?rejected=1`);
}

/** Removes someone's ID data and photos for good (e.g. when they ask). */
export async function deleteId(id: number) {
  await requireSuper();
  await deleteIdentity(id);
  revalidatePath("/admin/verifications");
  redirect("/admin/verifications?deleted=1");
}
