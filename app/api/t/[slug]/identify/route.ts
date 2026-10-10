import { handle, readJson } from "@/lib/api";
import { BookingError, identifyRider } from "@/lib/trips";

/** Members-only trips: confirms a registered rider from their phone (+ roll no. / employee ID). */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/identify">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    const rider = await identifyRider(slug, String(body.phone ?? ""), String(body.refNo ?? ""));
    if (!rider) throw new BookingError("We couldn't find you on the list. Check your phone number (and roll no. / ID), or ask your transport office to add you.", 404);
    return { rider: { name: rider.name, gender: rider.gender } };
  });
}
