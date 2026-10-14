import { NextResponse } from "next/server";
import { receivedMessage } from "@/lib/verify";
import { validSignature, waConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/** Meta checks the webhook once when you add it: echo the challenge if the verify token matches. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const { verifyToken } = waConfig();
  if (verifyToken && u.get("hub.mode") === "subscribe" && u.get("hub.verify_token") === verifyToken) return new NextResponse(u.get("hub.challenge") ?? "", { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

type Incoming = { entry?: { changes?: { value?: { messages?: { from?: string; type?: string; text?: { body?: string }; button?: { text?: string } }[] } }[] }[] };

/** Incoming WhatsApp messages (signed by Meta). Messages carrying a pending code verify the sender's number. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("Bad signature", { status: 401 });
  let body: Incoming = {};
  try {
    body = JSON.parse(raw);
  } catch {}
  for (const e of body.entry ?? [])
    for (const c of e.changes ?? [])
      for (const m of c.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? "";
        if (m.from && text) await receivedMessage(m.from, text).catch((err) => console.error("webhook", err));
      }
  // Always 200 so Meta doesn't retry.
  return NextResponse.json({ ok: true });
}
