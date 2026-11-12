/**
 * Reads today's petrol price from OGRA's newest price notice and sends it to the Hamsafar site. Runs daily on
 * GitHub Actions (.github/workflows/petrol-price.yml), because OGRA's firewall turns away requests from Vercel.
 * Without SITE_URL and CRON_SECRET it only prints what it found.
 */
import { parseNoticeList, parsePetrolPrice } from "../lib/ograParse";

const LIST = "https://www.ogra.org.pk/price-publications";
const headers = { "user-agent": "Mozilla/5.0 (compatible; HamsafarBot/1.0; +https://hamsafar.website)" };

async function main() {
  const list = await fetch(LIST, { headers });
  if (!list.ok) throw new Error(`OGRA list HTTP ${list.status}`);
  const notice = parseNoticeList(await list.text());
  if (!notice) throw new Error("No price notice found on OGRA's page");
  const pdf = await fetch(notice.url, { headers });
  if (!pdf.ok) throw new Error(`OGRA notice HTTP ${pdf.status}`);
  const { extractText, getDocumentProxy } = await import("unpdf");
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(await pdf.arrayBuffer())), { mergePages: true });
  const price = parsePetrolPrice(text);
  if (!price) throw new Error("Couldn't read the petrol price in the notice");
  console.log(`OGRA: petrol Rs ${price} a litre, effective ${notice.effective} (${notice.url})`);
  const site = process.env.SITE_URL, secret = process.env.CRON_SECRET;
  if (!site || !secret) return console.log("SITE_URL / CRON_SECRET not set: not sending it.");
  const res = await fetch(`${site.replace(/\/$/, "")}/api/petrol`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify({ price, effective: notice.effective, url: notice.url }),
  });
  const body = await res.text();
  console.log(`Site: HTTP ${res.status} ${body.slice(0, 300)}`);
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
