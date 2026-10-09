import { handle } from "@/lib/api";
import { BookingError, publicTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";

/** Live seat map for the booking page (polled while it's open). */
export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const trip = await publicTrip(slug);
    if (!trip) throw new BookingError("Trip not found", 404);
    return trip;
  });
}
