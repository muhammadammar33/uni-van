"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSuper } from "@/lib/auth";
import { requireDb, schema as s } from "@/lib/db";

const idOf = (fd: FormData) => Number(fd.get("id")) || 0;

/** Marks a feedback message as handled, or back to new. */
export async function setFeedbackStatus(fd: FormData) {
  await requireSuper();
  const status = fd.get("status") === "done" ? "done" : "new";
  await requireDb().update(s.feedback).set({ status }).where(eq(s.feedback.id, idOf(fd)));
  revalidatePath("/admin/feedback");
}

export async function deleteFeedback(fd: FormData) {
  await requireSuper();
  await requireDb().delete(s.feedback).where(eq(s.feedback.id, idOf(fd)));
  revalidatePath("/admin/feedback");
}

/** Hides an abusive or fake driver review from the public (or shows it again). */
export async function setReviewHidden(fd: FormData) {
  await requireSuper();
  await requireDb()
    .update(s.driverReviews)
    .set({ hidden: fd.get("hidden") === "1" })
    .where(eq(s.driverReviews.id, idOf(fd)));
  revalidatePath("/admin/feedback");
}
