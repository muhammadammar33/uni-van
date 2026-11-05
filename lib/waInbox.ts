import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";
import { alertAdmins } from "@/lib/notify";

/**
 * The admin's WhatsApp inbox for the business number: incoming messages (text, photos, voice notes, files,
 * locations...) saved from the webhook, and replies sent from the admin panel.
 */
const env = (k: string) => process.env[k]?.trim() || "";
const API = () => env("WHATSAPP_API_BASE") || "https://graph.facebook.com/v21.0";
const auth = () => ({ authorization: `Bearer ${env("WHATSAPP_TOKEN")}` });

/** Media bigger than this isn't copied into the database; it's fetched from WhatsApp when opened (kept there 30 days). */
const MAX_SAVED = 8 * 1024 * 1024;
/** WhatsApp only allows free-form replies within 24 hours of the person's last message. */
export const REPLY_WINDOW_MS = 24 * 3600 * 1000;
export const canReplyAfter = (lastIn: Date | undefined) => !!lastIn && Date.now() - lastIn.getTime() < REPLY_WINDOW_MS;

export type Incoming = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { id?: string; mime_type?: string; caption?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  document?: { id?: string; mime_type?: string; caption?: string; filename?: string };
  sticker?: { id?: string; mime_type?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  contacts?: { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[];
  reaction?: { emoji?: string };
};

const MEDIA = ["image", "video", "audio", "document", "sticker"] as const;

/** Downloads a message's media from WhatsApp: its address is looked up first, then fetched with the token. */
export async function downloadMedia(mediaId: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const meta = await fetch(`${API()}/${mediaId}`, { headers: auth(), cache: "no-store" });
  if (!meta.ok) return null;
  const m = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
  if (!m.url) return null;
  const file = await fetch(m.url, { headers: auth(), cache: "no-store" });
  if (!file.ok) return null;
  return { mime: m.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream", bytes: Buffer.from(await file.arrayBuffer()) };
}

/** What a message says, for the list and notifications. */
function describe(m: Incoming): string | null {
  switch (m.type) {
    case "text":
      return m.text?.body ?? "";
    case "image":
    case "video":
      return m[m.type]?.caption ?? null;
    case "document":
      return m.document?.caption ?? m.document?.filename ?? null;
    case "location": {
      const l = m.location ?? {};
      return [l.name, l.address].filter(Boolean).join(", ") || `${l.latitude},${l.longitude}`;
    }
    case "contacts":
      return (m.contacts ?? []).map((c) => [c.name?.formatted_name, c.phones?.[0]?.phone].filter(Boolean).join(" ")).join("; ");
    case "reaction":
      return m.reaction?.emoji ?? null;
    case "button":
      return m.button?.text ?? null;
    case "interactive":
      return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
    default:
      return null;
  }
}

export const KIND_LABEL: Record<string, string> = { template: "📋 Template", image: "📷 Photo", video: "🎬 Video", audio: "🎤 Voice note", document: "📄 File", sticker: "Sticker", location: "📍 Location", contacts: "👤 Contact", reaction: "Reaction" };

export function preview(type: string, body: string | null) {
  return type === "text" ? (body ?? "") : [KIND_LABEL[type] ?? type, body].filter(Boolean).join(": ");
}

/** Saves an incoming message (once, even if WhatsApp sends it again), its media, and tells the admins. */
export async function saveIncoming(m: Incoming, profileName: string | null) {
  if (!m.from || !m.id) return;
  const db = requireDb();
  const media = (MEDIA as readonly string[]).includes(m.type ?? "") ? (m[m.type as (typeof MEDIA)[number]] as { id?: string; mime_type?: string; filename?: string } | undefined) : undefined;
  const body = describe(m);
  const [row] = await db
    .insert(s.waMessages)
    .values({
      waId: m.from,
      name: profileName,
      direction: "in",
      type: m.type === "audio" && m.audio?.voice === false ? "audio" : (m.type ?? "unknown"),
      body,
      waMessageId: m.id,
      mediaId: media?.id ?? null,
      mime: media?.mime_type ?? null,
      fileName: m.type === "document" ? (m.document?.filename ?? null) : null,
      // Location: keep the coordinates so the inbox can link to the map.
      ...(m.type === "location" && m.location ? { fileName: `${m.location.latitude},${m.location.longitude}` } : {}),
    })
    .onConflictDoNothing({ target: s.waMessages.waMessageId })
    .returning();
  if (!row) return; // already saved
  if (media?.id) {
    const file = await downloadMedia(media.id).catch(() => null);
    if (file && file.bytes.length <= MAX_SAVED)
      await db.insert(s.waMedia).values({ messageId: row.id, mime: file.mime, data: file.bytes.toString("base64") }).onConflictDoNothing();
  }
  const who = profileName ? `${profileName} (+${m.from})` : `+${m.from}`;
  await alertAdmins(`WhatsApp: ${who}`, preview(row.type, body).slice(0, 140) || "New message", `/admin/whatsapp/${m.from}`, `wa-${m.from}`);
}

/** Delivery ticks for messages sent from the admin panel. */
export async function saveStatus(st: { id?: string; status?: string; errors?: { title?: string; message?: string }[] }) {
  if (!st.id || !st.status) return;
  const order = ["sent", "delivered", "read"];
  const db = requireDb();
  const [row] = await db.select().from(s.waMessages).where(eq(s.waMessages.waMessageId, st.id));
  if (!row) return;
  // Statuses can arrive out of order: never go back from "read" to "delivered".
  if (st.status !== "failed" && order.indexOf(row.status ?? "") >= order.indexOf(st.status)) return;
  await db
    .update(s.waMessages)
    .set({ status: st.status, error: st.status === "failed" ? (st.errors?.[0]?.message ?? st.errors?.[0]?.title ?? "Not delivered") : null })
    .where(eq(s.waMessages.id, row.id));
}

/* ---------- The inbox ---------- */

export async function conversations() {
  const db = requireDb();
  const rows = await db.execute<{ wa_id: string; name: string | null; last_at: Date; type: string; body: string | null; direction: string; unread: number }>(sql`
    select distinct on (m.wa_id) m.wa_id, n.name, m.created_at as last_at, m.type, m.body, m.direction,
      (select count(*)::int from wa_messages u where u.wa_id = m.wa_id and u.direction = 'in' and u.read_at is null) as unread
    from wa_messages m
    left join lateral (select name from wa_messages x where x.wa_id = m.wa_id and x.name is not null order by x.created_at desc limit 1) n on true
    order by m.wa_id, m.created_at desc`);
  return [...rows].sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());
}

export async function unreadCount() {
  const [r] = await requireDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(s.waMessages)
    .where(and(eq(s.waMessages.direction, "in"), isNull(s.waMessages.readAt)));
  return r?.n ?? 0;
}

export async function conversation(waId: string) {
  const db = requireDb();
  const rows = await db.select().from(s.waMessages).where(eq(s.waMessages.waId, waId)).orderBy(desc(s.waMessages.createdAt)).limit(300);
  return rows.reverse();
}

/** Marks their messages read here, and sends WhatsApp's blue ticks for the latest one. */
export async function markRead(waId: string) {
  const db = requireDb();
  const unread = await db
    .update(s.waMessages)
    .set({ readAt: new Date() })
    .where(and(eq(s.waMessages.waId, waId), eq(s.waMessages.direction, "in"), isNull(s.waMessages.readAt)))
    .returning({ waMessageId: s.waMessages.waMessageId, createdAt: s.waMessages.createdAt });
  const last = unread.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (last?.waMessageId)
    await fetch(`${API()}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: last.waMessageId }),
    }).catch(() => {});
}

export async function mediaFor(messageId: number) {
  const db = requireDb();
  const [saved] = await db.select().from(s.waMedia).where(eq(s.waMedia.messageId, messageId));
  if (saved) return { mime: saved.mime, bytes: Buffer.from(saved.data, "base64") };
  const [m] = await db.select().from(s.waMessages).where(eq(s.waMessages.id, messageId));
  return m?.mediaId ? downloadMedia(m.mediaId) : null;
}

/* ---------- Replies ---------- */

async function sendMessage(body: object) {
  const res = await fetch(`${API()}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const j = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(j.error?.message ?? `WhatsApp said ${res.status}`);
  return j.messages?.[0]?.id ?? null;
}

async function uploadMedia(file: File) {
  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("type", file.type);
  fd.append("file", file, file.name);
  const res = await fetch(`${API()}/${env("WHATSAPP_PHONE_NUMBER_ID")}/media`, { method: "POST", headers: auth(), body: fd });
  const j = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || !j.id) throw new Error(j.error?.message ?? "Couldn't upload the file to WhatsApp");
  return j.id;
}

const kindOf = (mime: string) => (mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "audio" : mime.startsWith("video/") ? "video" : "document");

/** Sends a reply (text, or a file with an optional caption) and keeps it in the conversation. */
export async function reply(waId: string, adminId: number, text: string, file: File | null) {
  if (!/^\d{8,15}$/.test(waId)) throw new Error("Not a WhatsApp number");
  const db = requireDb();
  const [lastIn] = await db
    .select({ at: s.waMessages.createdAt })
    .from(s.waMessages)
    .where(and(eq(s.waMessages.waId, waId), eq(s.waMessages.direction, "in")))
    .orderBy(desc(s.waMessages.createdAt))
    .limit(1);
  if (!lastIn || Date.now() - lastIn.at.getTime() > REPLY_WINDOW_MS)
    throw new Error("WhatsApp only allows replies within 24 hours of their last message. Ask them to message again, or call them.");
  text = text.trim().slice(0, 4000);
  if (!text && !file) throw new Error("Write a message or attach a file.");
  if (file && file.size > 4 * 1024 * 1024) throw new Error("Files can be 4 MB at most from here.");
  let type = "text";
  let waMessageId: string | null;
  if (file) {
    type = kindOf(file.type);
    const id = await uploadMedia(file);
    const caption = text && type !== "audio" ? { caption: text } : {};
    waMessageId = await sendMessage({ to: waId, type, [type]: { id, ...caption, ...(type === "document" ? { filename: file.name } : {}) } });
  } else {
    waMessageId = await sendMessage({ to: waId, type: "text", text: { body: text, preview_url: true } });
  }
  const [row] = await db
    .insert(s.waMessages)
    .values({ waId, direction: "out", type, body: text || null, waMessageId, status: "sent", mime: file?.type ?? null, fileName: file?.name ?? null, adminId, readAt: new Date() })
    .returning();
  if (file && file.size <= MAX_SAVED) await db.insert(s.waMedia).values({ messageId: row.id, mime: file.type, data: Buffer.from(await file.arrayBuffer()).toString("base64") });
  // An audio file can't carry a caption: send the words as their own message.
  if (file && type === "audio" && text) await reply(waId, adminId, text, null);
}

/* ---------- Starting a conversation (approved templates) ---------- */

export type WaTemplate = { name: string; language: string; category: string; body: string; params: number };

/**
 * The approved message templates of the WhatsApp Business Account behind this number. Outside the 24-hour
 * window WhatsApp only delivers these, so they're how a new conversation starts.
 */
const WABA_KEY = "wa_business_account_id";
/** Chosen by the admin for templates: used as it is, before any lookup. */
const CHOSEN_KEY = "wa_templates_account_id";
async function chosenWabaId() {
  const [row] = await requireDb().select().from(s.appSettings).where(eq(s.appSettings.key, CHOSEN_KEY));
  return row?.value ?? "";
}

/** The WhatsApp Business Account ID, as last seen (from the setup page, or from Meta's webhook deliveries). */
export async function savedWabaId(): Promise<string> {
  const [row] = await requireDb().select().from(s.appSettings).where(eq(s.appSettings.key, WABA_KEY));
  return row?.value ?? "";
}
export async function saveWabaId(id: string) {
  if (!/^\d{5,25}$/.test(id) || id === env("WHATSAPP_PHONE_NUMBER_ID")) return;
  if ((await savedWabaId()) === id) return;
  await requireDb().insert(s.appSettings).values({ key: WABA_KEY, value: id }).onConflictDoUpdate({ target: s.appSettings.key, set: { value: id } });
}

export async function waTemplates(): Promise<{ templates: WaTemplate[]; error: string | null; account?: string; others?: string[] }> {
  if (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_PHONE_NUMBER_ID")) return { templates: [], error: "WhatsApp isn't connected." };
  const get = async (path: string) => {
    const res = await fetch(`${API()}/${path}`, { headers: auth(), cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error?.message ?? `WhatsApp said ${res.status}`);
    return j;
  };
  try {
    // The account that owns this business number: a token often reaches other accounts too (such as Meta's
    // test account, which only has hello_world), so each candidate is checked against the number.
    const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
    const candidates = new Set<string>([env("WHATSAPP_BUSINESS_ACCOUNT_ID"), await savedWabaId()].filter(Boolean));
    const tok = await get(`debug_token?input_token=${encodeURIComponent(env("WHATSAPP_TOKEN"))}`).catch(() => null);
    for (const g of tok?.data?.granular_scopes ?? []) if (String(g.scope).startsWith("whatsapp_business")) for (const id of g.target_ids ?? []) candidates.add(String(id));
    candidates.delete(phoneId);
    let waba = env("WHATSAPP_BUSINESS_ACCOUNT_ID") || (await chosenWabaId());
    const checked: string[] = [];
    for (const id of waba ? [] : candidates) {
      const nums = await get(`${id}/phone_numbers?fields=id`).catch((e: Error) => ({ error: e.message }));
      checked.push(`${id}: ${"error" in nums ? nums.error : `${(nums.data ?? []).length} number(s)`}`);
      if ((nums?.data ?? []).some((n: { id?: string }) => String(n.id) === phoneId)) {
        waba = id;
        break;
      }
    }
    if (waba && waba !== (await chosenWabaId())) await saveWabaId(waba);
    // The account chosen on the setup page (or below the template list) is used even if Meta doesn't confirm the number.
    if (!waba) waba = env("WHATSAPP_BUSINESS_ACCOUNT_ID") || (await savedWabaId());
    if (!waba)
      return {
        templates: [],
        error: `the WhatsApp Business Account that owns this number wasn't found${checked.length ? ` (checked ${checked.join("; ")})` : ""}. Enter its ID below.`,
      };
    const j = await get(`${waba}/message_templates?fields=name,language,status,category,components&limit=100`);
    type Raw = { name: string; language: string; status: string; category: string; components?: { type: string; text?: string }[] };
    const templates = ((j?.data ?? []) as Raw[])
      .filter((t) => t.status === "APPROVED" && t.category !== "AUTHENTICATION")
      .map((t) => {
        const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
        const params = new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;
        return { name: t.name, language: t.language, category: t.category, body, params };
      });
    // Not usable yet (in review, rejected, paused) or not for chats (code templates): listed so the admin knows why.
    const others = ((j?.data ?? []) as Raw[])
      .filter((t) => !(t.status === "APPROVED" && t.category !== "AUTHENTICATION"))
      .map((t) => `${t.name} (${t.language}): ${t.category === "AUTHENTICATION" ? "code template" : t.status.toLowerCase().replace(/_/g, " ")}`);
    return { templates, error: null, account: waba, others };
  } catch (err) {
    return { templates: [], error: (err as Error).message };
  }
}

/** Sends an approved template (starts or reopens a conversation) and keeps it in the chat. */
export async function sendTemplateTo(waId: string, adminId: number, name: string, values: string[]) {
  if (!/^\d{8,15}$/.test(waId)) throw new Error("Not a WhatsApp number");
  const { templates, error } = await waTemplates();
  const t = templates.find((x) => x.name === name);
  if (!t) throw new Error(error ?? "That template isn't approved.");
  const params = values.slice(0, t.params).map((v) => v.trim().slice(0, 500));
  if (params.length < t.params || params.some((v) => !v)) throw new Error("Fill in every blank in the template.");
  const waMessageId = await sendMessage({
    to: waId,
    type: "template",
    template: { name: t.name, language: { code: t.language }, components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [] },
  }).catch((err: Error) => {
    // 132001: the template isn't in the account the sending number belongs to.
    if (/132001/.test(err.message))
      throw new Error(`WhatsApp can't find "${t.name}" for the number this site sends from. Create the template in the WhatsApp Business Account that holds that number (see WhatsApp → Setup: the one marked "has your number").`);
    throw err;
  });
  const body = t.body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "");
  await requireDb().insert(s.waMessages).values({ waId, direction: "out", type: "template", body, waMessageId, status: "sent", adminId, readAt: new Date() });
}

/** The admin picks the WhatsApp Business Account whose templates start chats (checked: its templates must load). */
export async function chooseWabaForTemplates(id: string): Promise<string | null> {
  id = id.replace(/\D/g, "");
  if (!/^\d{5,25}$/.test(id)) return "Enter the WhatsApp Business Account ID (numbers only).";
  if (id === env("WHATSAPP_PHONE_NUMBER_ID")) return "That's the phone number ID. Enter the WhatsApp Business Account ID.";
  const res = await fetch(`${API()}/${id}/message_templates?fields=name&limit=1`, { headers: auth(), cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return `WhatsApp refused that account: ${j?.error?.message ?? res.status}`;
  await requireDb().insert(s.appSettings).values({ key: CHOSEN_KEY, value: id }).onConflictDoUpdate({ target: s.appSettings.key, set: { value: id } });
  return null;
}
