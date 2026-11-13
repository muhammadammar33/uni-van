import { NextResponse } from "next/server";
import { lt, sql } from "drizzle-orm";
import { cronAllowed, logError } from "@/lib/api";
import { CHAT_KEEP_DAYS } from "@/lib/chat";
import { requireDb, schema as s } from "@/lib/db";
import { purgeReviewedPhotos } from "@/lib/identity";
import { refreshPetrolPrice } from "@/lib/petrol";

/**
 * Daily clean-up, run by Vercel Cron (vercel.json): ID photos past their keep time, and old chat messages.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; without CRON_SECRET set, nothing runs.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAllowed(req)) return new NextResponse("Not allowed", { status: 401 });
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
    // Today's petrol price from OGRA's official notice (fare suggestions and the fare cap use it).
    const petrol = await refreshPetrolPrice();
    if (!petrol.ok) logError("petrol price", { name: "OGRA", code: petrol.note });
    return NextResponse.json({ ok: true, photosDeleted: photos, chatMessagesDeleted: chats.length, petrol });
  } catch (err) {
    logError("cron daily", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
