import "server-only";
import { eq } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";

/**
 * The last WhatsApp webhook deliveries, for the admin to see why a number didn't verify.
 * Phone numbers are kept masked (last 4 digits) and message text isn't kept.
 */
export type WebhookEvent = { at: string; result: string; from?: string };
const KEY = "wa_webhook_log";

export const maskPhone = (p: string) => (p.length > 4 ? `…${p.slice(-4)}` : p);

export async function logWebhook(events: Omit<WebhookEvent, "at">[]) {
  if (!events.length) return;
  try {
    const db = requireDb();
    const [row] = await db.select().from(s.appSettings).where(eq(s.appSettings.key, KEY));
    const old: WebhookEvent[] = row ? JSON.parse(row.value) : [];
    const at = new Date().toISOString();
    const value = JSON.stringify([...events.map((e) => ({ at, ...e })), ...old].slice(0, 25));
    await db.insert(s.appSettings).values({ key: KEY, value }).onConflictDoUpdate({ target: s.appSettings.key, set: { value } });
  } catch (err) {
    console.error("webhook log", err);
  }
}

export async function webhookLog(): Promise<WebhookEvent[]> {
  const [row] = await requireDb().select().from(s.appSettings).where(eq(s.appSettings.key, KEY));
  return row ? JSON.parse(row.value) : [];
}
