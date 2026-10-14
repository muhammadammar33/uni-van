import { handle, readJson } from "@/lib/api";
import { clientKey, take } from "@/lib/rateLimit";
import { bookRide } from "@/lib/rides";

export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/book">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    await take(`book:${clientKey(req.headers)}`, 30, 3600, "Too many bookings from this connection. Please try again later.");
    return { booking: await bookRide(slug, await readJson(req)) };
  });
}
