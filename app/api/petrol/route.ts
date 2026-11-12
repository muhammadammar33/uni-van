import { after } from "next/server";
import { handle } from "@/lib/api";
import { currentPetrolPrice, lastPetrolTry, refreshPetrolPrice } from "@/lib/petrol";

/** Reading OGRA's PDF can take a while: allow it time when it runs after a response. */
export const maxDuration = 60;

/**
 * Today's petrol price for fare suggestions: { price, effective, source, lastTry }. OGRA's price is shared from
 * cache for an hour; the fallback (before OGRA was first read) only for a minute. `lastTry` says how the last
 * reading of OGRA went, so a failure can be seen.
 */
export async function GET() {
  const [p, last] = await Promise.all([currentPetrolPrice(), lastPetrolTry()]);
  // Missed the daily job (or it never ran): read OGRA in the background, for the next visitor. Not more than
  // once every 10 minutes while it keeps failing.
  const stale = !p.fetchedAt || Date.now() - Date.parse(p.fetchedAt) > 30 * 3600_000;
  const recentlyTried = last && Date.now() - Date.parse(last.at) < 10 * 60_000;
  if (stale && !recentlyTried) after(() => refreshPetrolPrice().then(() => {}));
  return handle(async () => ({ price: p.price, effective: p.effective, source: p.source, lastTry: last ? { at: last.at, ok: last.ok, note: last.note ?? null } : null }), {
    sharedCacheSeconds: p.source === "ogra" ? 3600 : 60,
  });
}
