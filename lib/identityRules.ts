/**
 * Rules for Pakistani ID documents, shared by the browser (to check as people type) and the server.
 * No network or database here, so it can be unit-tested.
 */

/** "12345-1234567-1" / "1234512345671" → "1234512345671", or null if it isn't 13 digits. */
export function cleanIdNumber(input: string): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  return d.length === 13 ? d : null;
}

/** "1234512345671" → "12345-1234567-1" */
export const formatIdNumber = (d: string) => (d.length === 13 ? `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}` : d);

/** On a CNIC (and B-form) the last digit is odd for men and even for women. */
export const genderFromIdNumber = (d: string): "male" | "female" => (Number(d[12]) % 2 === 1 ? "male" : "female");

/** Age in whole years on `today` ("YYYY-MM-DD"). */
export function ageOn(dob: string, today: string): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

const ymd = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (s: unknown): s is string => typeof s === "string" && ymd.test(s) && !Number.isNaN(Date.parse(s));

export const LICENSE_AUTHORITIES = {
  islamabad: { name: "Islamabad (ICT)", check: "https://islamabadpolice.gov.pk/" },
  punjab: { name: "Punjab", check: "https://dlims.punjab.gov.pk/verify" },
  sindh: { name: "Sindh", check: "https://dls.gos.pk/online-verification.html" },
  kp: { name: "Khyber Pakhtunkhwa", check: "https://dlims.kp.gov.pk/" },
  balochistan: { name: "Balochistan", check: null },
  ajk: { name: "Azad Kashmir", check: null },
  gb: { name: "Gilgit-Baltistan", check: null },
} as const;
export type LicenseAuthority = keyof typeof LICENSE_AUTHORITIES;

/** Official vehicle registration checks (Excise & Taxation), by the region a number plate looks like it's from. */
export const VEHICLE_CHECKS = [
  { name: "Punjab (MTMIS)", url: "https://mtmis.excise.punjab.gov.pk/" },
  { name: "Islamabad (ICT)", url: "https://ictadministration.gov.pk/" },
  { name: "Sindh", url: "https://excise.gos.pk/online-services/vehicle-verification" },
  { name: "Khyber Pakhtunkhwa", url: "https://www.kpexcise.gov.pk/" },
] as const;

export type IdCheckInput = {
  mode: "rider" | "driver";
  idType: "cnic" | "bform";
  idNumber: string;
  gender: "male" | "female";
  dob: string;
  idExpiry?: string | null;
  guardianCnic?: string | null;
  licenseExpiry?: string | null;
};

/**
 * Hard rules (a list of reasons it can't be accepted) and soft warnings (for the reviewer to look at).
 * `today` is "YYYY-MM-DD" in Pakistan time.
 */
export function checkId(i: IdCheckInput, today: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const num = cleanIdNumber(i.idNumber);
  if (!num) errors.push(i.idType === "cnic" ? "Enter your 13-digit CNIC number." : "Enter the 13-digit B-form number.");
  if (!isDate(i.dob)) errors.push("Enter your date of birth.");
  const age = isDate(i.dob) ? ageOn(i.dob, today) : null;
  if (age !== null && (age < 5 || age > 110)) errors.push("Check the date of birth.");
  if (i.idType === "cnic") {
    if (age !== null && age < 18) warnings.push(`Date of birth says ${age}: CNICs are issued from 18`);
    if (!isDate(i.idExpiry ?? "") && i.idExpiry !== "lifetime") errors.push("Enter the CNIC expiry date.");
    else if (i.idExpiry !== "lifetime" && i.idExpiry! < today) errors.push("This CNIC has expired. Please renew it first.");
  } else {
    if (age !== null && age >= 18) errors.push("At 18 or over, please verify with your own CNIC.");
    if (i.mode === "driver") errors.push("Drivers need their own CNIC and driving licence.");
    if (!cleanIdNumber(i.guardianCnic ?? "")) errors.push("Enter your parent's 13-digit CNIC number.");
  }
  if (num && genderFromIdNumber(num) !== i.gender) warnings.push(`The ID number's last digit means ${genderFromIdNumber(num)}, but ${i.gender} was chosen`);
  if (i.mode === "driver") {
    if (age !== null && age < 18) errors.push("Drivers must be 18 or older.");
    if (!isDate(i.licenseExpiry ?? "")) errors.push("Enter the driving licence expiry date.");
    else if (i.licenseExpiry! < today) errors.push("This driving licence has expired.");
  }
  return { errors, warnings };
}

/** "26.04.1995" / "26-04-1995" / "26/04/1995" → "1995-04-26" */
function toYmd(d: string) {
  const m = d.match(/(\d{2})[.\-/ ](\d{2})[.\-/ ](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Reads what it can from the OCR text of a CNIC's front (the English side): number, name, father's name,
 * gender, and the three dates in card order (birth, issue, expiry). Everything is a suggestion the person
 * confirms.
 */
export function parseCnicFront(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const num = text.match(/\b(\d{5})\s*[-–]?\s*(\d{7})\s*[-–]?\s*(\d)\b/);
  // Scans sometimes split a date's first digit off ("1\n7.06.2003"), so a lone digit just before one is joined.
  const dates = [...text.matchAll(/(?<!\d)(\d)?\s*(\d{1,2})[.\-/ ](\d{2})[.\-/ ](\d{4})\b/g)]
    .map((m) => {
      const day = ((m[1] ?? "") + m[2]).slice(-2).padStart(2, "0");
      return toYmd(`${day}.${m[3]}.${m[4]}`);
    })
    .filter((d): d is string => !!d && isDate(d));
  // Labels can have scan noise before them (the photo's edge), so text up to the label is dropped.
  const after = (label: RegExp, not?: RegExp) => {
    const i = lines.findIndex((l) => label.test(l) && !not?.test(l));
    if (i < 0) return null;
    const rest = lines[i].slice(lines[i].search(label)).replace(label, "").replace(/^[\s:.\-]+/, "").trim();
    const v = rest.length > 2 ? rest : (lines[i + 1] ?? "");
    const name = v.replace(/[^A-Za-z .'-]/g, "").replace(/\s+/g, " ").trim();
    // Scan noise ("Oom Oo P Re") isn't a name: every word needs a vowel and 2+ letters, and 2+ real words.
    const words = name.split(" ");
    const real = words.length >= 2 && words.every((w) => w.length >= 2 && /[aeiouy]/i.test(w)) && words.filter((w) => w.length >= 3).length >= 2;
    return real ? name.replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) : null;
  };
  const sorted = [...new Set(dates)].sort();
  // A CNIC holder is at least 18, so a recent date (the issue date) can't be the birth date.
  const thisYear = new Date().getFullYear();
  const birth = sorted.find((d) => Number(d.slice(0, 4)) <= thisYear - 15) ?? null;
  let expiry = sorted.length >= 2 && sorted[sorted.length - 1] !== birth ? sorted[sorted.length - 1] : null;
  // A CNIC is valid for 10 years from its issue date (same day and month). If the expiry shares the issue
  // date's day and month but not the year, one of its digits was misread (2034 read as 2038).
  const issue = sorted.filter((d) => d !== birth && d !== expiry && (!birth || d > birth)).pop();
  if (issue && expiry && issue.slice(5) === expiry.slice(5) && Number(expiry.slice(0, 4)) - Number(issue.slice(0, 4)) !== 10)
    expiry = `${Number(issue.slice(0, 4)) + 10}${issue.slice(4)}`;
  // "Gender" is a heading; the letter is on the same line or starts the next one ("M Pakistan").
  const gi = lines.findIndex((l) => /\bGender\b/i.test(l));
  const g =
    text.match(/\bGender\b[\s:.]*([MF])\b/)?.[1] ??
    (gi >= 0 ? lines[gi + 1]?.match(/^([MF])\b/)?.[1] : undefined) ??
    text.match(/^\s*([MF])\s*$/m)?.[1];
  return {
    idNumber: num ? num[1] + num[2] + num[3] : null,
    name: after(/\bName\b/i, /(Father|Husband)/i),
    fatherName: after(/\b(Father|Husband)\s*Name\b/i),
    gender: g === "M" ? ("male" as const) : g === "F" ? ("female" as const) : null,
    // Birth is the earliest date (and old enough), expiry the latest.
    dob: birth,
    expiry,
  };
}
