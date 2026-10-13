import { handle, readJson } from "@/lib/api";
import { cancelRideBooking } from "@/lib/rides";

export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/cancel">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    await cancelRideBooking(slug, String(body.phone ?? ""), String(body.code ?? ""));
    return { ok: true };
  });
}
