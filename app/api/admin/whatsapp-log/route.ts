import { NextResponse } from "next/server";
import { superAdminOrNull } from "@/lib/auth";
import { verifyMode } from "@/lib/verify";
import { waConfig } from "@/lib/whatsapp";
import { webhookLog } from "@/lib/webhookLog";

export const dynamic = "force-dynamic";

/** Super admins: is WhatsApp set up, and what reached the webhook lately (newest first). */
export async function GET() {
  if (!(await superAdminOrNull())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const c = waConfig();
  return NextResponse.json(
    { mode: verifyMode(), canSend: c.canSend, canReceive: c.canReceive, businessNumber: c.businessNumber, deliveries: await webhookLog() },
    { headers: { "cache-control": "no-store" } },
  );
}
