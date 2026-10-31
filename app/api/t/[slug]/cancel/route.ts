import { revalidatePath } from "next/cache";
import { handle, readJson } from "@/lib/api";
import { guardBookingCode } from "@/lib/rateLimit";
import { cancelBooking } from "@/lib/trips";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/cancel">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const phone = String(body.phone ?? "");
    await guardBookingCode(req.headers, `t:${slug}`, phone, () => cancelBooking(slug, phone, String(body.code ?? "")));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
