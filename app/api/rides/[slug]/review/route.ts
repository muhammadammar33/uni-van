import { handle, readJson } from "@/lib/api";
import { reviewDriver } from "@/lib/rides";

/** A rider rates the driver after the ride (needs the phone + booking code). */
export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/review">) {
  const { slug } = await ctx.params;
  return handle(async () => ({ review: await reviewDriver(slug, await readJson(req)) }));
}
