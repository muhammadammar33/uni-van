import "server-only";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { requireDb, schema as s } from "@/lib/db";
import { canonicalUrl } from "@/lib/url";
import { sendTemplate, waConfig } from "@/lib/whatsapp";

/**
 * The site's own push-notification keys, made once and kept in the database (so there's nothing to set up).
 * The public key is given to browsers that subscribe.
 */
export async function vapidKeys() {
  const db = requireDb();
  const rows = await db.select().from(s.appSettings).where(eq(s.appSettings.key, "vapid"));
  if (rows[0]) return JSON.parse(rows[0].value) as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  await db.insert(s.appSettings).values({ key: "vapid", value: JSON.stringify(keys) }).onConflictDoNothing();
  const [saved] = await db.select().from(s.appSettings).where(eq(s.appSettings.key, "vapid"));
  return JSON.parse(saved.value) as { publicKey: string; privateKey: string };
}

export async function savePushSubscription(adminId: number, sub: unknown) {
  const v = sub as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof v?.endpoint !== "string" || !/^https?:\/\//.test(v.endpoint) || typeof v.keys?.p256dh !== "string" || typeof v.keys?.auth !== "string")
    throw new Error("bad subscription");
  const row = { adminId, endpoint: v.endpoint, p256dh: v.keys.p256dh, auth: v.keys.auth };
  await requireDb().insert(s.pushSubscriptions).values(row).onConflictDoUpdate({ target: s.pushSubscriptions.endpoint, set: row });
}

/**
 * Tells the super admins: a push notification on every phone/computer they turned notifications on for, and
 * a WhatsApp message if ADMIN_WHATSAPP and WHATSAPP_ALERT_TEMPLATE (a "Utility" template with {{1}}) are set.
 * Never throws: a failed alert mustn't fail the person's submission.
 */
export async function alertAdmins(title: string, body: string, path: string) {
  const db = requireDb();
  try {
    const [keys, subs] = await Promise.all([vapidKeys(), db.select().from(s.pushSubscriptions)]);
    const payload = JSON.stringify({ title, body, url: path });
    await Promise.all(
      subs.map((sub) =>
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
            TTL: 24 * 3600,
            urgency: "high",
            vapidDetails: { subject: canonicalUrl(), publicKey: keys.publicKey, privateKey: keys.privateKey },
          })
          .catch(async (err: { statusCode?: number }) => {
            // The browser unsubscribed or the subscription expired: forget it.
            if (err?.statusCode === 404 || err?.statusCode === 410) await db.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.id, sub.id));
            else console.error("push failed", err?.statusCode ?? err);
          }),
      ),
    );
  } catch (err) {
    console.error("push alert failed", err);
  }
  const to = (process.env.ADMIN_WHATSAPP ?? "").replace(/\D/g, "");
  const template = process.env.WHATSAPP_ALERT_TEMPLATE?.trim();
  if (to && template && waConfig().canSend) await sendTemplate(to, template, [`${title}: ${body}`]).catch((err) => console.error("WhatsApp alert failed", err));
}
