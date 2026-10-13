import { handle, readJson } from "@/lib/api";
import { createRide, searchRides } from "@/lib/rides";
import { decodePoint } from "@/lib/places";

export const dynamic = "force-dynamic";

/** Search: ?from=<place key or lat,lng|name>&to=...&date=YYYY-MM-DD */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  return handle(async () => {
    const date = u.get("date");
    return { rides: await searchRides(decodePoint(u.get("from")), decodePoint(u.get("to")), date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null) };
  });
}

/** A driver offers a ride. Returns the public slug and the secret manage token. */
export async function POST(req: Request) {
  return handle(async () => createRide(await readJson(req)));
}
