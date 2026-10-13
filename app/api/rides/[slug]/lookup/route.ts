import { handle, readJson } from "@/lib/api";
import { BookingError } from "@/lib/trips";
import { lookupRideBooking } from "@/lib/rides";

export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/lookup">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const booking = await lookupRideBooking(slug, String(body.phone ?? ""), String(body.code ?? ""));
    if (!booking) throw new BookingError("No upcoming booking found for that phone number and code.", 404);
    return { booking };
  });
}
