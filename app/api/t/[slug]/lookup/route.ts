import { handle, readJson } from "@/lib/api";
import { BookingError, lookupBooking } from "@/lib/trips";

/** Finds a passenger's own booking from their phone number and booking code. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/lookup">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const booking = await lookupBooking(slug, String(body.phone ?? ""), String(body.code ?? ""));
    if (!booking) throw new BookingError("No booking found for that phone number and code.", 404);
    return { booking };
  });
}
