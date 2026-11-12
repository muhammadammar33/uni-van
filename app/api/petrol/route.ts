import { after } from "next/server";
import { handle } from "@/lib/api";
import { currentPetrolPrice, refreshPetrolPrice } from "@/lib/petrol";

/**
 * Today's petrol price for fare suggestions: { price, effective, source }. OGRA's price is shared from cache for
 * an hour; the fallback (before OGRA was first read) only for a minute.
 */
export async function GET() {
  const p = await currentPetrolPrice();
  // Missed the daily job (or it never ran): read OGRA in the background, for the next visitor.
  const stale = !p.fetchedAt || Date.now() - Date.parse(p.fetchedAt) > 30 * 3600_000;
  if (stale) after(() => refreshPetrolPrice().then(() => {}));
  return handle(async () => ({ price: p.price, effective: p.effective, source: p.source }), { sharedCacheSeconds: p.source === "ogra" ? 3600 : 60 });
}
