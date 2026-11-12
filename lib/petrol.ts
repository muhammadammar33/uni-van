import "server-only";
import { eq } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";
import { logError } from "@/lib/api";
import { PETROL_PRICE } from "@/lib/fare";
import { parseNoticeList, parsePetrolPrice } from "@/lib/ograParse";

/**
 * Today's petrol price, from OGRA (the Oil and Gas Regulatory Authority), which publishes an official price
 * notice (a PDF) on most days: "Price Publications Effective Dated <date>" at ogra.org.pk/price-publications.
 * The daily job reads the newest notice and saves "Total Petrol Price" (Rs a litre). If OGRA can't be read,
 * or a price looks wrong, the last good price stays; NEXT_PUBLIC_PETROL_PRICE is the fallback before the first.
 */
const LIST_URL = process.env.OGRA_PRICES_URL || "https://www.ogra.org.pk/price-publications";
const KEY = "petrol_price";
/** A sane range, and the most a single update may move the price; anything else waits for a person. */
const MIN = 150;
const MAX = 800;
const MAX_JUMP = 0.25;

export type PetrolPrice = { price: number; effective: string | null; source: "ogra" | "default"; fetchedAt: string | null };

export async function currentPetrolPrice(): Promise<PetrolPrice> {
  try {
    const [row] = await requireDb().select().from(s.appSettings).where(eq(s.appSettings.key, KEY));
    if (row) {
      const v = JSON.parse(row.value) as PetrolPrice;
      if (v.price >= MIN && v.price <= MAX) return v;
    }
  } catch (err) {
    logError("petrol price read", err);
  }
  return { price: PETROL_PRICE, effective: null, source: "default", fetchedAt: null };
}

type Outcome = { ok: boolean; price?: number; effective?: string; note?: string };

/** The last attempt's outcome, kept so a failure can be seen (no secrets in it). */
export async function lastPetrolTry(): Promise<(Outcome & { at: string }) | null> {
  try {
    const [row] = await requireDb().select().from(s.appSettings).where(eq(s.appSettings.key, `${KEY}_last_try`));
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}

/** Reads OGRA's newest notice and saves its petrol price. Returns what happened (for the daily job's log). */
export async function refreshPetrolPrice(): Promise<Outcome> {
  const out = await readOgra();
  const value = JSON.stringify({ ...out, at: new Date().toISOString() });
  await requireDb()
    .insert(s.appSettings)
    .values({ key: `${KEY}_last_try`, value })
    .onConflictDoUpdate({ target: s.appSettings.key, set: { value } })
    .catch(() => {});
  return out;
}

async function readOgra(): Promise<Outcome> {
  const headers = { "user-agent": "Mozilla/5.0 (compatible; HamsafarBot/1.0)" };
  try {
    const list = await fetch(LIST_URL, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!list.ok) return { ok: false, note: `OGRA list HTTP ${list.status}` };
    const notice = parseNoticeList(await list.text());
    if (!notice) return { ok: false, note: "No price notice found on OGRA's page" };
    const before = await currentPetrolPrice();
    if (before.source === "ogra" && before.effective === notice.effective) return { ok: true, price: before.price, effective: before.effective, note: "Already up to date" };
    const pdf = await fetch(notice.url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!pdf.ok) return { ok: false, note: `OGRA notice HTTP ${pdf.status}` };
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(await pdf.arrayBuffer()));
    const { text } = await extractText(doc, { mergePages: true });
    const price = parsePetrolPrice(text);
    if (!price || price < MIN || price > MAX) return { ok: false, note: `Unreadable or out-of-range petrol price (${price})` };
    if (before.source === "ogra" && Math.abs(price - before.price) / before.price > MAX_JUMP)
      return { ok: false, note: `Price jumped from ${before.price} to ${price}: kept the old one, please check` };
    const value: PetrolPrice = { price, effective: notice.effective, source: "ogra", fetchedAt: new Date().toISOString() };
    await requireDb()
      .insert(s.appSettings)
      .values({ key: KEY, value: JSON.stringify(value) })
      .onConflictDoUpdate({ target: s.appSettings.key, set: { value: JSON.stringify(value) } });
    return { ok: true, price, effective: notice.effective };
  } catch (err) {
    logError("petrol price refresh", err);
    const e = err as { name?: string; message?: string };
    return { ok: false, note: `Couldn't read OGRA: ${e?.name ?? "Error"} ${String(e?.message ?? "").slice(0, 160)}` };
  }
}
