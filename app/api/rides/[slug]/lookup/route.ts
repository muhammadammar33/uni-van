import { handle, readJson } from "@/lib/api";
import { guardBookingCode } from "@/lib/rateLimit";
import { lookupRideBooking } from "@/lib/rides";
import { BookingError } from "@/lib/trips";

/** The rider's booking by phone + code: the upcoming one, or the last one done (so they can rate the driver). */
export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/lookup">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const phone = String(body.phone ?? "");
    return guardBookingCode(req.headers, slug, phone, async () => {
      const found = await lookupRideBooking(slug, phone, String(body.code ?? ""));
      if (!found) throw new BookingError("No booking found for that phone number and code.", 404);
      return found;
    });
  });
}
