import { handle } from "@/lib/api";
import { removeRideBooking } from "@/lib/rides";

/** The driver removes a rider's booking. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/rides/manage/[token]/booking/[id]">) {
  const { token, id } = await ctx.params;
  return handle(async () => {
    await removeRideBooking(token, Number(id));
    return { ok: true };
  });
}
