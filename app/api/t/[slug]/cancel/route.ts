import { revalidatePath } from "next/cache";
import { handle, readJson } from "@/lib/api";
import { cancelBooking } from "@/lib/trips";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/cancel">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    await cancelBooking(slug, String(body.phone ?? ""), String(body.code ?? ""));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
