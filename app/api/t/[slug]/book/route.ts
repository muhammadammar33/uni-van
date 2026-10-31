import { revalidatePath } from "next/cache";
import { handle, readJson } from "@/lib/api";
import { clientKey, take } from "@/lib/rateLimit";
import { bookSeat } from "@/lib/trips";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/book">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    await take(`tbook-ip:${clientKey(req.headers)}`, 10, 3600, "Too many bookings from this connection. Please try again later.");
    await take(`tbook-trip:${slug}`, 80, 3600, "Too many bookings on this trip right now. Please try again later.");
    const booking = await bookSeat({ slug }, await readJson(req));
    revalidatePath("/admin", "layout");
    return { booking };
  });
}
