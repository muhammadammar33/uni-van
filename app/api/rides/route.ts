import { handle, readJson } from "@/lib/api";
import { clientKey, take } from "@/lib/rateLimit";
import { createRide, searchRides } from "@/lib/rides";
import { accountFor } from "@/lib/account";
import { decodePoint } from "@/lib/places";
import { kindFor } from "@/lib/cities";

export const dynamic = "force-dynamic";

/** Search: ?from=<place key or lat,lng|name>&to=...&date=YYYY-MM-DD&kind=city|intercity */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return handle(async () => {
    const date = u.get("date");
    const from = decodePoint(u.get("from"));
    const to = decodePoint(u.get("to"));
    return { rides: await searchRides(from, to, date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, kindFor(u.get("kind"), from, to)) };
  });
}

/** A driver offers a ride. Returns the public slug and the secret manage token. */
export async function POST(req: Request) {
  return handle(async () => {
    await take(`ride-new:${clientKey(req.headers)}`, 10, 3600, "You've offered a lot of rides in the last hour. Please try again later.");
    const user = await accountFor("offer a ride");
    return createRide(await readJson(req), user);
  });
}
