import { normalizePhone } from "@/lib/format";
import type { Gender } from "@/lib/layout";

/** Columns of the rider list template, in order. Headers are matched loosely (case, spaces, common synonyms). */
export const RIDER_COLUMNS = ["Name", "Phone", "Gender", "Roll No", "Class", "Stop"] as const;

const HEADER_ALIASES: Record<string, (typeof RIDER_COLUMNS)[number]> = {
  name: "Name", fullname: "Name", studentname: "Name", employeename: "Name",
  phone: "Phone", mobile: "Phone", phoneno: "Phone", phonenumber: "Phone", mobileno: "Phone", contact: "Phone", whatsapp: "Phone", cell: "Phone",
  gender: "Gender", sex: "Gender",
  rollno: "Roll No", rollnumber: "Roll No", roll: "Roll No", regno: "Roll No", registrationno: "Roll No", employeeid: "Roll No", empid: "Roll No", id: "Roll No", cms: "Roll No", cmsid: "Roll No",
  class: "Class", section: "Class", program: "Class", programme: "Class", department: "Class", dept: "Class", shift: "Class", batch: "Class", semester: "Class",
  stop: "Stop", pickup: "Stop", pickuppoint: "Stop", area: "Stop", route: "Stop",
};

export type RiderRow = { name: string; phone: string; gender: Gender; refNo: string | null; groupName: string | null; stop: string | null };
export type RowProblem = { row: number; message: string };

function parseGender(v: string): Gender | null {
  const g = v.trim().toLowerCase();
  if (["f", "female", "girl", "woman", "f.", "fem"].includes(g)) return "female";
  if (["m", "male", "boy", "man", "m."].includes(g)) return "male";
  return null;
}

/**
 * Turns spreadsheet rows (first row = headers) into riders, with a reason for every row that can't be used.
 * Pure, so the same check runs in the browser (preview) and on the server (import).
 */
export function readRiderRows(table: unknown[][]): { riders: RiderRow[]; problems: RowProblem[]; missing: string[] } {
  const [header = [], ...body] = table;
  const index: Partial<Record<(typeof RIDER_COLUMNS)[number], number>> = {};
  header.forEach((h, i) => {
    const key = String(h ?? "").toLowerCase().replace(/[^a-z]/g, "");
    const col = HEADER_ALIASES[key];
    if (col && index[col] === undefined) index[col] = i;
  });
  const missing = (["Name", "Phone", "Gender"] as const).filter((c) => index[c] === undefined);
  if (missing.length) return { riders: [], problems: [], missing };

  const riders: RiderRow[] = [];
  const problems: RowProblem[] = [];
  const seen = new Map<string, number>();
  const cell = (row: unknown[], col: (typeof RIDER_COLUMNS)[number]) => {
    const i = index[col];
    return i === undefined ? "" : String(row[i] ?? "").trim();
  };
  body.forEach((row, i) => {
    const line = i + 2; // spreadsheet row number, header is row 1
    if (!row || row.every((c) => String(c ?? "").trim() === "")) return;
    const name = cell(row, "Name");
    const phone = normalizePhone(cell(row, "Phone"));
    const gender = parseGender(cell(row, "Gender"));
    if (name.length < 2) return problems.push({ row: line, message: "Name is missing" });
    if (!phone) return problems.push({ row: line, message: `"${cell(row, "Phone") || "(empty)"}" is not a phone number` });
    if (!gender) return problems.push({ row: line, message: `Gender "${cell(row, "Gender") || "(empty)"}" should be Male or Female` });
    if (seen.has(phone)) return problems.push({ row: line, message: `Same phone as row ${seen.get(phone)}` });
    seen.set(phone, line);
    riders.push({
      name: name.slice(0, 80),
      phone,
      gender,
      refNo: cell(row, "Roll No").slice(0, 40) || null,
      groupName: cell(row, "Class").slice(0, 80) || null,
      stop: cell(row, "Stop").slice(0, 80) || null,
    });
  });
  return { riders, problems, missing };
}

/** Minimal CSV reader (quotes, commas and newlines inside quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((v) => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\n");
}
