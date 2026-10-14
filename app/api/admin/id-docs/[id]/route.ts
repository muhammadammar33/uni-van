import { NextResponse } from "next/server";
import { superAdminOrNull } from "@/lib/auth";
import { openDoc } from "@/lib/identity";

/** An ID photo, for super admins only. Never cached; every view is logged. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/id-docs/[id]">) {
  const admin = await superAdminOrNull();
  if (!admin) return new NextResponse("Not allowed", { status: 403 });
  const doc = await openDoc(Number((await ctx.params).id), admin.id);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(doc.bytes), {
    headers: { "content-type": doc.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-disposition": "inline" },
  });
}
