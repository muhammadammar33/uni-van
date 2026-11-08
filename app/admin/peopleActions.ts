"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuper } from "@/lib/auth";
import { blockPerson, unblockPerson } from "@/lib/people";
import { deleteAccount } from "@/lib/deleteAccount";
import { BookingError } from "@/lib/trips";

const idOf = (fd: FormData) => Number(fd.get("id")) || 0;

export async function blockAction(fd: FormData) {
  const admin = await requireSuper();
  const id = idOf(fd);
  const reason = String(fd.get("reason") === "Other" ? fd.get("other") : fd.get("reason") ?? "");
  let to = `/admin/people/${id}`;
  try {
    const r = await blockPerson(id, admin.id, reason);
    to += `?blocked=${r.paused}`;
  } catch (err) {
    to += `?error=${encodeURIComponent(err instanceof BookingError ? err.message : "Couldn't block")}`;
  }
  revalidatePath("/admin/people");
  redirect(to);
}

export async function unblockAction(fd: FormData) {
  await requireSuper();
  await unblockPerson(idOf(fd));
  revalidatePath("/admin/people");
  redirect(`/admin/people/${idOf(fd)}?unblocked=1`);
}

/** Deletes someone's account on their request (e.g. they asked on WhatsApp and can't sign in). */
export async function deleteAccountAction(fd: FormData) {
  await requireSuper();
  await deleteAccount(idOf(fd));
  revalidatePath("/admin/people");
  redirect("/admin/people?deleted=1");
}
