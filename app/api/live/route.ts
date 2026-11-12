import { handle, readJson } from "@/lib/api";
import { clientKey, take } from "@/lib/rateLimit";
import { livePositions, shareLive, stopLive } from "@/lib/rides";

export const dynamic = "force-dynamic";

/** People sharing their location right now (?ride=<slug> for one ride's driver). */
export async function GET(req: Request) {
  const ride = new URL(req.url).searchParams.get("ride") ?? undefined;
  // The same for every visitor (riders are already blurred and nameless), so shared from cache for 10 s.
  return handle(async () => ({ positions: await livePositions(ride) }), { sharedCacheSeconds: 10 });
}

/** Share or update my position. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    // Riders appear without signing in, so a cap per visitor keeps fake dots off the map. Drivers need their ride link.
    if (body.role !== "driver") await take(`live-ip:${clientKey(req.headers)}`, 240, 3600, "Too many location updates. Please try again later.");
    await shareLive(body);
    return { ok: true };
  });
}

/** Stop sharing: { id } */
export async function DELETE(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    if (typeof body.id === "string") await stopLive(body.id);
    return { ok: true };
  });
}
