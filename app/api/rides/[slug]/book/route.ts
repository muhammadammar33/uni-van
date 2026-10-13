import { handle, readJson } from "@/lib/api";
import { bookRide } from "@/lib/rides";

export async function POST(req: Request, ctx: RouteContext<"/api/rides/[slug]/book">) {
  const { slug } = await ctx.params;
  return handle(async () => ({ booking: await bookRide(slug, await readJson(req)) }));
}
