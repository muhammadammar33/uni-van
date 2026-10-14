import { NextResponse } from "next/server";
import { superAdminOrNull } from "@/lib/auth";
import { mediaFor } from "@/lib/waInbox";

/** A WhatsApp message's photo / voice note / file, for the admin inbox only. */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/wa-media/[id]">) {
  if (!(await superAdminOrNull())) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const id = Number((await ctx.params).id);
  const file = Number.isInteger(id) ? await mediaFor(id) : null;
  if (!file) return NextResponse.json({ error: "Not found (WhatsApp keeps media for 30 days)" }, { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "content-type": file.mime,
      "content-length": String(file.bytes.length),
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
      // Never run uploaded files as a page on this site.
      "content-security-policy": "default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      ...(download ? { "content-disposition": "attachment" } : {}),
    },
  });
}
