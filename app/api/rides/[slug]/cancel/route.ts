import { handle, readJson } from "@/lib/api";
import { guardBookingCode } from "@/lib/rateLimit";
import { cancelRideBooking } from "@/lib/rides";

export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/cancel">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const phone = String(body.phone ?? "");
    await guardBookingCode(req.headers, slug, phone, () => cancelRideBooking(slug, phone, String(body.code ?? "")));
    return { ok: true };
  });
}
