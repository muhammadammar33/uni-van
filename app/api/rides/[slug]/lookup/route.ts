import { handle, readJson } from "@/lib/api";
import { BookingError } from "@/lib/trips";
import { lookupRideBooking } from "@/lib/rides";

/** The rider's booking by phone + code: the upcoming one, or the last one done (so they can rate the driver). */
export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/lookup">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const found = await lookupRideBooking(slug, String(body.phone ?? ""), String(body.code ?? ""));
    if (!found) throw new BookingError("No booking found for that phone number and code.", 404);
    return found;
  });
}
