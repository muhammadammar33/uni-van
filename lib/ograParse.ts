/** Reading OGRA's price notices (see lib/petrol.ts). Kept free of server-only code so tests can import it. */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
function ymd(text: string) {
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(text);
  const mo = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  return m && mo >= 0 ? `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

/** The newest notice's date and PDF link from OGRA's list page. */
export function parseNoticeList(html: string): { effective: string; url: string } | null {
  const re = /Price Publications Effective Dated\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})[\s\S]{0,600}?href="(https:\/\/www\.ogra\.org\.pk\/download\/\d+\?lang=en)"/;
  const m = re.exec(html);
  const effective = m ? ymd(m[1]) : null;
  return m && effective ? { effective, url: m[2] } : null;
}

/** "Total Petrol Price (excl. Secondary Freight*) RS/LTR X 332.00" from the notice's text. */
export function parsePetrolPrice(text: string): number | null {
  const flat = text.replace(/\s+/g, " ");
  const m =
    /Total Petrol Price \(excl\. Secondary Freight\*?\) RS\/LTR X (\d{2,4}(?:\.\d{1,2})?)/i.exec(flat) ??
    /Total Calculated Petrol Price RS\/LTR V=\{[^}]*\} (\d{2,4}(?:\.\d{1,2})?)/i.exec(flat);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

