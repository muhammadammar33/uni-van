import { handle, readJson } from "@/lib/api";
import { submitFeedback } from "@/lib/feedback";

/** Ideas, problems and safety reports for the Hamsafar team. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return handle(async () => {
    await submitFeedback(await readJson(req), ip);
    return { ok: true };
  });
}
