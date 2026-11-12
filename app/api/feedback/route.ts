import { after } from "next/server";
import { handle, readJson } from "@/lib/api";
import { alertAdmins } from "@/lib/notify";
import { submitFeedback } from "@/lib/feedback";
import { clientKey, take } from "@/lib/rateLimit";

/** Ideas, problems and safety reports for the Hamsafar team. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for"))?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return handle(async () => {
    // Counted before anything else, so messages sent all at once can't get past the limit.
    await take(`feedback:${clientKey(req.headers)}`, 8, 3600, "Thank you! You've sent several messages already. Please try again in an hour.");
    const body = await readJson(req);
    await submitFeedback(body, ip);
    // Safety reports (and SOS) reach the team's phones at once, not just the inbox.
    if (body.kind === "safety") {
      const sos = String(body.message ?? "").startsWith("SOS");
      after(() => alertAdmins(sos ? "🚨 SOS on a ride" : "Safety report", String(body.message ?? "").split("\n")[0].slice(0, 140), "/admin/feedback", sos ? "hamsafar-sos" : "hamsafar-safety"));
    }
    return { ok: true };
  });
}
