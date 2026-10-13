import { handle } from "@/lib/api";
import { BookingError } from "@/lib/trips";
import { publicRide } from "@/lib/rides";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/rides/[slug]">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const ride = await publicRide(slug);
    if (!ride) throw new BookingError("Ride not found", 404);
    return ride;
  });
}
