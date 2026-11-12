"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/account";
import { deleteAccount } from "@/lib/deleteAccount";
import { USER_COOKIE } from "@/lib/userSession";
import { revalidatePath } from "next/cache";
import { deleteRouteAlert } from "@/lib/routeAlerts";

/** The signed-in person deletes their own account (they type DELETE to confirm). */
export async function deleteMyAccount(_: { error?: string } | null, form: FormData): Promise<{ error?: string } | null> {
  const u = await currentUser();
  if (!u) redirect("/signin?next=/me");
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") return { error: "Type DELETE to confirm." };
  await deleteAccount(u.id);
  (await cookies()).delete(USER_COOKIE);
  redirect("/delete-account?done=1");
}

/** Stop a route alert. */
export async function removeRouteAlert(form: FormData) {
  const u = await currentUser();
  if (!u) redirect("/signin?next=/me");
  await deleteRouteAlert(u.id, Number(form.get("id")));
  revalidatePath("/me");
}
