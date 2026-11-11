import { NextResponse } from "next/server";
import { lt, sql } from "drizzle-orm";
import { logError } from "@/lib/api";
import { CHAT_KEEP_DAYS } from "@/lib/chat";
import { requireDb, schema as s } from "@/lib/db";
import { purgeReviewedPhotos } from "@/lib/identity";

/**
 * Daily clean-up, run by Vercel Cron (vercel.json): ID photos past their keep time, and old chat messages.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; without CRON_SECRET set, nothing runs.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Not allowed", { status: 401 });
  try {
    let photos = 0;
    for (let i = 0; i < 10; i++) {
      const n = await purgeReviewedPhotos();
      photos += n;
      if (!n) break;
    }
    const chats = await requireDb()
      .delete(s.chatMessages)
      .where(lt(s.chatMessages.createdAt, sql`now() - make_interval(days => ${CHAT_KEEP_DAYS})`))
      .returning({ id: s.chatMessages.id });
    return NextResponse.json({ ok: true, photosDeleted: photos, chatMessagesDeleted: chats.length });
  } catch (err) {
    logError("cron daily", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
