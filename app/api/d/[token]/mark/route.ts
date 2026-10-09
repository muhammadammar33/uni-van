import { revalidatePath } from "next/cache";
import { handle, readJson } from "@/lib/api";
import { markBooking } from "@/lib/trips";

/** Driver ticks a passenger as boarded or paid. */
export async function POST(req: Request, ctx: RouteContext<"/api/d/[token]/mark">) {
  const { token } = await ctx.params;
  return handle(async () => {
    await markBooking({ driverToken: token }, await readJson(req));
    revalidatePath("/admin", "layout");
    return { ok: true };
  });
}
