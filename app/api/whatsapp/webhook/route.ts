import { after, NextResponse } from "next/server";
import { saveIncoming, saveStatus, type Incoming } from "@/lib/waInbox";
import { receivedMessage } from "@/lib/verify";
import { validSignature, waConfig } from "@/lib/whatsapp";
import { logWebhook, maskPhone } from "@/lib/webhookLog";

export const dynamic = "force-dynamic";

/** Meta checks the webhook once when you add it: echo the challenge if the verify token matches. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const { verifyToken } = waConfig();
  if (verifyToken && u.get("hub.mode") === "subscribe" && u.get("hub.verify_token") === verifyToken) return new NextResponse(u.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

type Payload = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: Incoming[];
        statuses?: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }[];
      };
    }[];
  }[];
};

/**
 * Incoming WhatsApp messages (signed by Meta). A message carrying a pending code verifies the sender's
 * number; every other message goes to the admin's WhatsApp inbox. Delivery ticks update sent replies.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    // Signed but wrong: the App secret in the settings doesn't match the app's (unsigned posts aren't logged).
    if (req.headers.get("x-hub-signature-256")) await logWebhook([{ result: "bad_signature: check WHATSAPP_APP_SECRET" }]);
    return new NextResponse("Bad signature", { status: 401 });
  }
  let body: Payload = {};
  try {
    body = JSON.parse(raw);
  } catch {}
  const log: { result: string; from?: string }[] = [];
  const toInbox: { m: Incoming; name: string | null }[] = [];
  const statuses: NonNullable<NonNullable<NonNullable<Payload["entry"]>[number]["changes"]>[number]["value"]>["statuses"] = [];
  for (const e of body.entry ?? [])
    for (const c of e.changes ?? []) {
      const names = new Map((c.value?.contacts ?? []).map((x) => [x.wa_id, x.profile?.name ?? null]));
      statuses.push(...(c.value?.statuses ?? []));
      for (const m of c.value?.messages ?? []) {
        if (!m.from) continue;
        const text = m.text?.body ?? m.button?.text ?? "";
        const result = text ? await receivedMessage(m.from, text).catch((err) => (console.error("webhook", err), "error")) : `${m.type}`;
        log.push({ result, from: maskPhone(m.from) });
        // Codes are for the website, not the inbox.
        const isCode = result === "verified" || result === "wrong_number" || /hamsafar code/i.test(text);
        if (!isCode) toInbox.push({ m, name: names.get(m.from) ?? null });
      }
    }
  await logWebhook(log);
  // Saving photos and voice notes and notifying the admin happens after Meta has its answer.
  if (toInbox.length || statuses.length)
    after(async () => {
      for (const { m, name } of toInbox) await saveIncoming(m, name).catch((err) => console.error("inbox", err));
      for (const st of statuses) await saveStatus(st).catch((err) => console.error("inbox status", err));
    });
  // Always 200 so Meta doesn't retry.
  return NextResponse.json({ ok: true });
}
