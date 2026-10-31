import { handle, readJson } from "@/lib/api";
import { clientKey, take } from "@/lib/rateLimit";
import { BookingError, identifyRider } from "@/lib/trips";

/** Members-only trips: confirms a registered rider from their phone (+ roll no. / employee ID). */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/identify">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    // Looking people up by phone: a few tries per visitor and per trip, so a roster can't be harvested.
    await take(`identify-ip:${clientKey(req.headers)}`, 20, 3600, "Too many tries. Please wait an hour, or ask your transport office.");
    await take(`identify-trip:${slug}`, 300, 3600, "Too many tries on this trip right now. Please try again later.");
    const rider = await identifyRider(slug, String(body.phone ?? ""), String(body.refNo ?? ""));
    if (!rider) throw new BookingError("We couldn't find you on the list. Check your phone number (and roll no. / ID), or ask your transport office to add you.", 404);
    return { rider: { name: rider.name, gender: rider.gender } };
  });
}
