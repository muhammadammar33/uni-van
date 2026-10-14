import { NextResponse } from "next/server";
import { superAdminOrNull } from "@/lib/auth";
import { savePushSubscription, vapidKeys } from "@/lib/notify";

/** GET: the public key browsers need to subscribe. POST: save this browser's subscription. Super admins only. */
export async function GET() {
  if (!(await superAdminOrNull())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  return NextResponse.json({ publicKey: (await vapidKeys()).publicKey });
}

export async function POST(req: Request) {
  const admin = await superAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  try {
    await savePushSubscription(admin.id, await req.json());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't save this device" }, { status: 400 });
  }
}
