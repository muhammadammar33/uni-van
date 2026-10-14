import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * WhatsApp Business Cloud API (Meta). Configured with environment variables:
 * - WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID: the business number that sends messages.
 * - WHATSAPP_OTP_TEMPLATE (+ WHATSAPP_OTP_LANG, default "en"): an approved "Authentication" template, to send codes.
 * - WHATSAPP_BUSINESS_NUMBER, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN: to receive messages (free) on the webhook.
 */
const env = (k: string) => process.env[k]?.trim() || "";
const API = () => env("WHATSAPP_API_BASE") || "https://graph.facebook.com/v21.0";

export const waConfig = () => ({
  canSend: !!(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID") && env("WHATSAPP_OTP_TEMPLATE")),
  canReceive: !!(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID") && env("WHATSAPP_BUSINESS_NUMBER") && env("WHATSAPP_APP_SECRET") && env("WHATSAPP_VERIFY_TOKEN")),
  businessNumber: env("WHATSAPP_BUSINESS_NUMBER").replace(/\D/g, ""),
  verifyToken: env("WHATSAPP_VERIFY_TOKEN"),
});

async function post(body: unknown) {
  const res = await fetch(`${API()}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...(body as object) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("WhatsApp API error", res.status, detail.slice(0, 500));
    throw new Error("whatsapp_send_failed");
  }
}

/** Sends a one-time code with the approved Authentication template (body {{1}} + "copy code" button). */
export function sendCode(to: string, code: string) {
  return post({
    to,
    type: "template",
    template: {
      name: env("WHATSAPP_OTP_TEMPLATE"),
      language: { code: env("WHATSAPP_OTP_LANG") || "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: code }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
      ],
    },
  });
}

/** A plain reply; only allowed within 24 hours of the person's last message to us (and free then). */
export function sendText(to: string, text: string) {
  return post({ to, type: "text", text: { body: text, preview_url: false } });
}

/** Checks Meta's X-Hub-Signature-256 header, so only WhatsApp can post to the webhook. */
export function validSignature(rawBody: string, header: string | null) {
  const secret = env("WHATSAPP_APP_SECRET");
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}
