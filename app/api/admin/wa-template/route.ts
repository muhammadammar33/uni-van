import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api";
import { superAdminOrNull } from "@/lib/auth";
import { sendTemplateTo } from "@/lib/waInbox";

/** Start (or reopen) a WhatsApp conversation with an approved template: { waId, name, values }. */
export async function POST(req: Request) {
  const admin = await superAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  try {
    assertSameOrigin(req);
    const b = (await req.json().catch(() => ({}))) as { waId?: unknown; name?: unknown; values?: unknown };
    const values = Array.isArray(b.values) ? b.values.slice(0, 10).map((v) => String(v ?? "")) : [];
    await sendTemplateTo(String(b.waId ?? ""), admin.id, String(b.name ?? ""), values);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
