import { handle, readJson } from "@/lib/api";
import { chatPeek, chatThread, reportChat, sendChat, setChatClosed } from "@/lib/chat";
import { BookingError } from "@/lib/trips";

/**
 * A booking's private driver-rider chat. Body: { key, action, ... }. The key (from the rider's booking or the
 * driver's page) says who is asking.
 * - load { after }: messages after that id (latest ones when 0), marking them read
 * - peek: unread count only
 * - send { text } · close · reopen · report { reason }
 */
export async function POST(req: Request, ctx: RouteContext<"/api/chat/[id]">) {
  const id = Number((await ctx.params).id);
  return handle(async () => {
    const body = await readJson(req);
    const key = String(body.key ?? "");
    switch (body.action) {
      case "load":
        return chatThread(id, key, Number(body.after ?? 0));
      case "peek":
        return chatPeek(id, key);
      case "send":
        return { message: await sendChat(id, key, body.text) };
      case "close":
      case "reopen":
        await setChatClosed(id, key, body.action === "close");
        return chatThread(id, key, 0);
      case "report":
        await reportChat(id, key, body.reason);
        return { ok: true };
      default:
        throw new BookingError("Unknown chat action");
    }
  });
}
