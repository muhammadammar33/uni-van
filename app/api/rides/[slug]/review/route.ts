import { handle, readJson } from "@/lib/api";
import { guardBookingCode } from "@/lib/rateLimit";
import { reviewDriver } from "@/lib/rides";

/** A rider rates the driver after the ride (needs the phone + booking code). */
export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/review">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    return { review: await guardBookingCode(req.headers, slug, String(body.phone ?? ""), () => reviewDriver(slug, body)) };
  });
}
