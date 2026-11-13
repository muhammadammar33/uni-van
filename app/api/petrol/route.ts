import { after } from "next/server";
import { cronAllowed, handle } from "@/lib/api";
import { currentPetrolPrice, lastPetrolTry, refreshPetrolPrice, savePetrolPrice } from "@/lib/petrol";

/** Reading OGRA's PDF can take a while: allow it time when it runs after a response. */
export const maxDuration = 60;

/**
 * Today's petrol price for fare suggestions: { price, effective, source, lastTry }. OGRA's price is shared from
 * cache for an hour; the fallback (before OGRA was first read) only for a minute. `lastTry` says how the last
 * reading of OGRA went, so a failure can be seen.
 */
export async function GET() {
  const [p, last] = await Promise.all([currentPetrolPrice(), lastPetrolTry()]);
  // Older than a day: try reading OGRA in the background (its firewall often refuses servers; an admin then
  // enters the price on /admin/petrol). Not more than every 6 hours.
  const stale = !p.fetchedAt || Date.now() - Date.parse(p.fetchedAt) > 26 * 3600_000;
  const recentlyTried = last && Date.now() - Date.parse(last.at) < 6 * 3600_000;
  if (stale && !recentlyTried) after(() => refreshPetrolPrice().then(() => {}));
  return handle(async () => ({ price: p.price, effective: p.effective, source: p.source, lastTry: last ? { at: last.at, ok: last.ok, note: last.note ?? null } : null }), {
    sharedCacheSeconds: p.source === "default" ? 60 : 600,
  });
}

/**
 * The daily GitHub Actions job (scripts/ogra-petrol.ts) sends what it read from OGRA: { price, effective, url },
 * with `Authorization: Bearer <CRON_SECRET>`. The same checks apply as when the site reads OGRA itself.
 */
export async function POST(req: Request) {
  if (!cronAllowed(req)) return new Response("Not allowed", { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { price?: unknown; effective?: unknown; url?: unknown };
  if (typeof body.url !== "string" || !/^https:\/\/www\.ogra\.org\.pk\/download\/\d+\?lang=en$/.test(body.url))
    return Response.json({ ok: false, note: "Not an OGRA notice link" }, { status: 400 });
  const out = await savePetrolPrice(Number(body.price), String(body.effective ?? ""));
  return Response.json(out, { status: out.ok ? 200 : 422, headers: { "cache-control": "no-store" } });
}
