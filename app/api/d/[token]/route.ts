import { handle } from "@/lib/api";
import { BookingError, driverTrip } from "@/lib/trips";

export const dynamic = "force-dynamic";

/** Passenger list for the driver's page (polled while it's open). */
export async function GET(_req: Request, ctx: RouteContext<"/api/d/[token]">) {
  const { token } = await ctx.params;
  return handle(async () => {
    const trip = await driverTrip(token);
    if (!trip) throw new BookingError("Trip not found", 404);
    return trip;
  });
}
