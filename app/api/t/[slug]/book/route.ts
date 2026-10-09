import { revalidatePath } from "next/cache";
import { handle, readJson } from "@/lib/api";
import { bookSeat } from "@/lib/trips";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/book">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const booking = await bookSeat({ slug }, await readJson(req));
    revalidatePath("/admin", "layout");
    return { booking };
  });
}
