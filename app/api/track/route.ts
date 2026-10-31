import { NextResponse } from "next/server";
import { trackView } from "@/lib/analytics";

/** A page view (sent by the browser in the background). Never fails the page: errors are swallowed. */
export async function POST(req: Request) {
  try {
    const path = (await req.text()).slice(0, 300);
    await trackView(path, req.headers);
  } catch {}
  return new NextResponse(null, { status: 204 });
}
