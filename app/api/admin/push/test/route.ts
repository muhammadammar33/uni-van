import { NextResponse } from "next/server";
import { superAdminOrNull } from "@/lib/auth";
import { alertAdmins } from "@/lib/notify";

/** Sends a test notification to every device a super admin turned notifications on for. */
export async function POST() {
  if (!(await superAdminOrNull())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  await alertAdmins("Hamsafar notifications are on", "You'll get a message like this when someone sends their ID.", "/admin/verifications");
  return NextResponse.json({ ok: true });
}
