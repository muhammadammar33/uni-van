import { handle, readJson } from "@/lib/api";
import { guardBookingCode } from "@/lib/rateLimit";
import { BookingError, lookupBooking } from "@/lib/trips";

/** Finds a passenger's own booking from their phone number and booking code. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/lookup">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const phone = String(body.phone ?? "");
    const booking = await guardBookingCode(req.headers, `t:${slug}`, phone, async () => {
      const b = await lookupBooking(slug, phone, String(body.code ?? ""));
      if (!b) throw new BookingError("No booking found for that phone number and code.", 404);
      return b;
    });
    return { booking };
  });
}
