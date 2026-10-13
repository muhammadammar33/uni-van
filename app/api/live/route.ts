import { handle, readJson } from "@/lib/api";
import { livePositions, shareLive, stopLive } from "@/lib/rides";

export const dynamic = "force-dynamic";

/** People sharing their location right now (?ride=<slug> for one ride's driver). */
export async function GET(req: Request) {
  const ride = new URL(req.url).searchParams.get("ride") ?? undefined;
  return handle(async () => ({ positions: await livePositions(ride) }));
}

/** Share or update my position. */
export async function POST(req: Request) {
  return handle(async () => {
    await shareLive(await readJson(req));
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
