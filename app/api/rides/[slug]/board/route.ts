import { handle, readJson } from "@/lib/api";
import { guardBookingCode } from "@/lib/rateLimit";
import { boardRide } from "@/lib/rides";

/** In the car: { phone, code (booking code), rideCode (what the driver says) } → the booking, marked on board. */
export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/board">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const phone = String(body.phone ?? "");
    return { booking: await guardBookingCode(req.headers, slug, phone, () => boardRide(slug, phone, String(body.code ?? ""), body.rideCode)) };
  });
}
