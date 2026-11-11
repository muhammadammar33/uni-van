import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { requireDb, schema as s } from "@/lib/db";
import { formatDate, formatTime, nowLocal } from "@/lib/format";
import { addDays } from "@/lib/schedule";
import { isPhoneBlocked } from "@/lib/people";
import { pushLater } from "@/lib/push";
import { take } from "@/lib/rateLimit";
import { BookingError } from "@/lib/trips";

/**
 * Private chat between a driver and one rider who booked a seat. Text only. It opens with the booking and
 * closes a day after the ride; either side can close it (block) or report it. Messages are deleted with the
 * booking, and on their own after CHAT_KEEP_DAYS. The team never browses chats: reporting one copies it into
 * a safety report.
 */

export type ChatSide = "driver" | "rider";
export const CHAT_MAX_LENGTH = 500;
export const CHAT_KEEP_DAYS = 30;
/** Messages one side can send per booking within 10 minutes (plenty to coordinate, too few to spam). */
const SEND_LIMIT = 30;

/** Quick replies shown above the text box. */
export const QUICK_REPLIES: Record<ChatSide, string[]> = {
  rider: ["I'm at the pickup point", "Running 5 minutes late", "Where are you?", "Thank you!"],
  driver: ["I'm at the pickup point", "Leaving in 5 minutes", "Running 5 minutes late", "Where are you?"],
};

const other = (side: ChatSide): ChatSide => (side === "driver" ? "rider" : "driver");
const first = (name: string) => name.trim().split(/\s+/)[0];

/**
 * The key that lets one side open one booking's chat. It's handed only to someone who already proved who they
 * are (the rider's booking code or account, the driver's private link), so polling for messages doesn't have
 * to check those again every few seconds. Derived from the server secret: nothing to store or leak.
 */
export function chatKey(bookingId: number, side: ChatSide) {
  return createHmac("sha256", `hamsafar-chat:${process.env.AUTH_SECRET ?? ""}`).update(`${bookingId}:${side}`).digest("base64url").slice(0, 32);
}

function sideForKey(bookingId: number, key: string): ChatSide | null {
  for (const side of ["rider", "driver"] as const) {
    const want = Buffer.from(chatKey(bookingId, side));
    const got = Buffer.from(key);
    if (got.length === want.length && timingSafeEqual(got, want)) return side;
  }
  return null;
}

/** Sending is possible from booking until 24 hours after the ride leaves. */
export function chatOpenUntil(date: string, departTime: string) {
  return `${addDays(date, 1)} ${departTime}`;
}

type Ctx = { side: ChatSide; ride: s.Ride; booking: s.RideBooking };

async function load(bookingId: number, key: string): Promise<Ctx> {
  const side = Number.isInteger(bookingId) && bookingId > 0 && typeof key === "string" ? sideForKey(bookingId, key) : null;
  if (!side) throw new BookingError("This chat link isn't valid.", 403);
  const [row] = await requireDb()
    .select({ ride: s.rides, booking: s.rideBookings })
    .from(s.rideBookings)
    .innerJoin(s.rides, eq(s.rides.id, s.rideBookings.rideId))
    .where(eq(s.rideBookings.id, bookingId))
    .limit(1);
  if (!row) throw new BookingError("This booking was cancelled, so its chat is gone.", 404);
  return { side, ...row };
}

const phoneOf = (c: Ctx, side: ChatSide) => (side === "driver" ? c.ride.driverPhone : c.booking.phone);
const nameOf = (c: Ctx, side: ChatSide) => (side === "driver" ? c.ride.driverName : c.booking.name);

/** Why nobody can send right now, or null when the chat is open. */
async function closedReason(c: Ctx): Promise<string | null> {
  if (c.booking.chatClosedBy === c.side) return "You closed this chat.";
  if (c.booking.chatClosedBy) return `${first(nameOf(c, other(c.side)))} closed this chat.`;
  if (c.ride.status === "cancelled") return "This ride was cancelled.";
  if (nowLocal() > chatOpenUntil(c.booking.date, c.ride.departTime)) return "This chat closed a day after the ride.";
  const [meBlocked, themBlocked] = await Promise.all([isPhoneBlocked(phoneOf(c, c.side)), isPhoneBlocked(phoneOf(c, other(c.side)))]);
  if (meBlocked) return "Your account can't send messages.";
  if (themBlocked) return "This person can't be messaged.";
  return null;
}

export type ChatView = {
  side: ChatSide;
  otherName: string;
  /** The ride, for the chat's header. */
  about: string;
  closed: string | null;
  /** The person who closed it can open it again. */
  canReopen: boolean;
  /** Messages after `after` (or the latest ones on first load), oldest first. */
  messages: { id: number; mine: boolean; body: string; at: string }[];
  /** The other side has seen my messages up to this id. */
  seenUpTo: number;
  quickReplies: string[];
};

/** Messages since `after` (all recent ones when 0). Opening the chat marks everything as read. */
export async function chatThread(bookingId: number, key: string, after = 0): Promise<ChatView> {
  const c = await load(bookingId, key);
  const db = requireDb();
  const since = Math.max(0, Math.floor(Number(after) || 0));
  const rows = since
    ? await db
        .select()
        .from(s.chatMessages)
        .where(and(eq(s.chatMessages.bookingId, bookingId), gt(s.chatMessages.id, since)))
        .orderBy(asc(s.chatMessages.id))
        .limit(200)
    : (
        await db.select().from(s.chatMessages).where(eq(s.chatMessages.bookingId, bookingId)).orderBy(desc(s.chatMessages.id)).limit(200)
      ).reverse();
  const last = rows.at(-1)?.id ?? 0;
  const readCol = c.side === "driver" ? s.rideBookings.driverReadId : s.rideBookings.riderReadId;
  const myRead = c.side === "driver" ? c.booking.driverReadId : c.booking.riderReadId;
  if (last > myRead) await db.update(s.rideBookings).set({ [c.side === "driver" ? "driverReadId" : "riderReadId"]: last }).where(and(eq(s.rideBookings.id, bookingId), lt(readCol, last)));
  const closed = await closedReason(c);
  return {
    side: c.side,
    otherName: nameOf(c, other(c.side)),
    about: `${formatDate(c.booking.date)} · ${formatTime(c.ride.departTime)}`,
    closed,
    canReopen: c.booking.chatClosedBy === c.side,
    messages: rows.map((m) => ({ id: m.id, mine: m.sender === c.side, body: m.body, at: m.createdAt.toISOString() })),
    seenUpTo: c.side === "driver" ? c.booking.riderReadId : c.booking.driverReadId,
    quickReplies: QUICK_REPLIES[c.side],
  };
}

/** How many messages are waiting (without marking them read), and whether the chat is open. */
export async function chatPeek(bookingId: number, key: string) {
  const c = await load(bookingId, key);
  const myRead = c.side === "driver" ? c.booking.driverReadId : c.booking.riderReadId;
  const [{ n }] = await requireDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(s.chatMessages)
    .where(and(eq(s.chatMessages.bookingId, bookingId), eq(s.chatMessages.sender, other(c.side)), gt(s.chatMessages.id, myRead)));
  return { unread: n };
}

/** Removes control characters, trims, and keeps blank lines from piling up. */
export function cleanMessage(raw: unknown) {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendChat(bookingId: number, key: string, raw: unknown) {
  const c = await load(bookingId, key);
  const body = cleanMessage(raw);
  if (!body) throw new BookingError("Write a message first.");
  if (body.length > CHAT_MAX_LENGTH) throw new BookingError(`Keep messages under ${CHAT_MAX_LENGTH} characters.`);
  const closed = await closedReason(c);
  if (closed) throw new BookingError(closed, 409);
  await take(`chat:${bookingId}:${c.side}`, SEND_LIMIT, 600, "You're sending messages very fast. Please wait a few minutes.");
  const db = requireDb();
  const [m] = await db.insert(s.chatMessages).values({ bookingId, sender: c.side, body }).returning();
  // Sending means you've read everything before it.
  await db
    .update(s.rideBookings)
    .set({ [c.side === "driver" ? "driverReadId" : "riderReadId"]: m.id })
    .where(eq(s.rideBookings.id, bookingId));
  const to = other(c.side);
  pushLater([phoneOf(c, to)], {
    title: `${first(nameOf(c, c.side))} · Hamsafar`,
    body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
    url: to === "rider" ? `/r/${c.ride.slug}?chat=1` : "/me",
    tag: `chat-${bookingId}`,
  });
  // Now and then, clear out old chats (kept only CHAT_KEEP_DAYS).
  if (Math.random() < 0.02) await db.delete(s.chatMessages).where(lt(s.chatMessages.createdAt, sql`now() - make_interval(days => ${CHAT_KEEP_DAYS})`));
  return { id: m.id, mine: true, body: m.body, at: m.createdAt.toISOString() };
}

/** Close (block) the chat, or open it again. Only the person who closed it can reopen it. */
export async function setChatClosed(bookingId: number, key: string, close: boolean) {
  const c = await load(bookingId, key);
  if (!close && c.booking.chatClosedBy && c.booking.chatClosedBy !== c.side) throw new BookingError("Only the person who closed this chat can open it again.", 403);
  if (close && c.booking.chatClosedBy) return;
  await requireDb()
    .update(s.rideBookings)
    .set({ chatClosedBy: close ? c.side : null })
    .where(eq(s.rideBookings.id, bookingId));
}

/**
 * Report: closes the chat and sends the Hamsafar team a safety report with a copy of the conversation (so it
 * stays even if the booking is cancelled afterwards).
 */
export async function reportChat(bookingId: number, key: string, reasonRaw: unknown) {
  const c = await load(bookingId, key);
  const reason = cleanMessage(reasonRaw).slice(0, 1000);
  if (reason.length < 5) throw new BookingError("Tell us briefly what happened.");
  await take(`chat-report:${bookingId}:${c.side}`, 3, 24 * 3600, "You've already reported this chat. The team will look into it.");
  const db = requireDb();
  const msgs = await db.select().from(s.chatMessages).where(eq(s.chatMessages.bookingId, bookingId)).orderBy(desc(s.chatMessages.id)).limit(150);
  const when = (d: Date) => d.toLocaleString("en-GB", { timeZone: process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const label = (side: ChatSide) => `${side === "driver" ? "Driver" : "Rider"} ${nameOf(c, side)} (${phoneOf(c, side)})`;
  const transcript = msgs
    .reverse()
    .map((m) => `[${when(m.createdAt)}] ${m.sender === "driver" ? "Driver" : "Rider"}: ${m.body}`)
    .join("\n");
  const message = [
    `CHAT REPORT: the ${c.side} reported the ${other(c.side)}.`,
    `Reason: ${reason}`,
    "",
    `Ride ${formatDate(c.booking.date)} ${formatTime(c.ride.departTime)} (/r/${c.ride.slug})`,
    `Reported by: ${label(c.side)}`,
    `Reported: ${label(other(c.side))}`,
    "",
    "--- Conversation ---",
    transcript || "(no messages)",
  ].join("\n");
  await db.insert(s.feedback).values({
    kind: "safety",
    role: c.side,
    message,
    name: nameOf(c, c.side),
    contact: phoneOf(c, c.side),
    page: "chat",
    rideSlug: c.ride.slug,
  });
  await db.update(s.rideBookings).set({ chatClosedBy: c.side }).where(and(eq(s.rideBookings.id, bookingId), sql`${s.rideBookings.chatClosedBy} is null`));
}

/** Unread messages from riders, per booking, for the driver's page. */
export async function driverUnread(bookings: { id: number; driverReadId: number }[]) {
  if (!bookings.length) return new Map<number, number>();
  const rows = await requireDb()
    .select({ bookingId: s.chatMessages.bookingId, n: sql<number>`count(*)::int` })
    .from(s.chatMessages)
    .innerJoin(s.rideBookings, eq(s.rideBookings.id, s.chatMessages.bookingId))
    .where(
      and(
        inArray(
          s.chatMessages.bookingId,
          bookings.map((b) => b.id),
        ),
        eq(s.chatMessages.sender, "rider"),
        gt(s.chatMessages.id, s.rideBookings.driverReadId),
      ),
    )
    .groupBy(s.chatMessages.bookingId);
  return new Map(rows.map((r) => [r.bookingId, r.n]));
}
