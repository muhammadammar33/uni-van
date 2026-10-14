import { handle, readJson } from "@/lib/api";
import { tripAction } from "@/lib/rides";

/** Today's trip: { action: "leave", stopIdx } or { action: "noshow", bookingId, undo? }. */
export async function POST(req: Request, ctx: RouteContext<"/api/rides/manage/[token]/trip">) {
  const { token } = await ctx.params;
  return handle(async () => tripAction(token, await readJson(req)));
}
