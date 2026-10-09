/** Timezone trips are planned in. Dates and times are stored as plain local strings ("2026-10-12", "07:15"). */
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi";

/**
 * Normalises a phone number to digits with country code, so "0300-1234567", "+92 300 1234567"
 * and "923001234567" are the same person. Returns null when it doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "92" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("3")) digits = "92" + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** "923001234567" -> "0300 1234567" for Pakistani numbers, "+<digits>" otherwise. */
export function displayPhone(digits: string): string {
  if (digits.startsWith("92") && digits.length === 12) return `0${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
}

/** "07:15" -> "7:15 AM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * "2026-10-12" -> "Mon, 12 Oct", or "Monday, 12 October 2026" when `long`.
 * Built by hand so the server and every browser render exactly the same text.
 */
export function formatDate(ymd: string, long = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const day = DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const month = MONTHS[mo - 1];
  return long ? `${day}, ${d} ${month} ${y}` : `${day.slice(0, 3)}, ${d} ${month.slice(0, 3)}`;
}

/** Current local date-time as "YYYY-MM-DDTHH:MM" in TIMEZONE, comparable with stored strings. */
export function nowLocal(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function todayLocal(): string {
  return nowLocal().slice(0, 10);
}

export const DIRECTION_LABEL = { to_uni: "To University", to_home: "To Home" } as const;
export const GENDER_LABEL = { male: "Male", female: "Female", any: "Anyone" } as const;

export function defaultTitle(direction: keyof typeof DIRECTION_LABEL, date: string) {
  return `Van ${DIRECTION_LABEL[direction].toLowerCase()} · ${formatDate(date)}`;
}

/** 1500 -> "Rs. 1,500" */
export function formatFare(rupees: number): string {
  return `Rs. ${rupees.toLocaleString("en-US")}`;
}
