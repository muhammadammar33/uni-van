import { formatDate } from "@/lib/format";

/** When a carpool ride runs: one date, every day, or chosen weekdays (from a start date, optionally until an end date). */
export type Schedule = { kind: "once" | "daily" | "weekly"; date: string; days: number[]; until: string | null };

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const weekday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function runsOn(s: Schedule, ymd: string): boolean {
  if (ymd < s.date) return false;
  if (s.kind === "once") return ymd === s.date;
  if (s.until && ymd > s.until) return false;
  if (s.kind === "daily") return true;
  return s.days.includes(weekday(ymd));
}

/** The next `n` dates the ride runs, starting from `from` (inclusive). */
export function nextRuns(s: Schedule, from: string, n = 5): string[] {
  const out: string[] = [];
  let d = from < s.date ? s.date : from;
  for (let i = 0; i < 370 && out.length < n; i++, d = addDays(d, 1)) {
    if (s.until && d > s.until) break;
    if (runsOn(s, d)) out.push(d);
    if (s.kind === "once") break;
  }
  return out;
}

/** "Every day", "Mon – Fri", "Mon, Wed, Fri", "Once · Tue, 14 Oct" */
export function describeSchedule(s: Schedule): string {
  if (s.kind === "once") return `Once · ${formatDate(s.date)}`;
  const until = s.until ? ` until ${formatDate(s.until)}` : "";
  if (s.kind === "daily") return `Every day${until}`;
  const days = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Monday first
  const key = days.join(",");
  const label =
    key === "1,2,3,4,5" ? "Mon – Fri" : key === "1,2,3,4,5,6" ? "Mon – Sat" : key === "0,6" || key === "6,0" ? "Weekends" : days.map((d) => WEEKDAYS[d]).join(", ");
  return `${label}${until}`;
}
