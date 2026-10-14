import { NextResponse } from "next/server";
import { superAdminOrNull } from "@/lib/auth";
import { reply } from "@/lib/waInbox";

/** Reply from the admin inbox: form data with waId, text and an optional file. */
export async function POST(req: Request) {
  const admin = await superAdminOrNull();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    await reply(String(fd.get("waId") ?? ""), admin.id, String(fd.get("text") ?? ""), file instanceof File && file.size > 0 ? file : null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
