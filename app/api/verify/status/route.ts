import { handle } from "@/lib/api";
import { verificationStatus } from "@/lib/verify";

export const dynamic = "force-dynamic";

/** ?id= → { verified, token? } while waiting for the person's WhatsApp message. */
export async function GET(req: Request) {
  return handle(() => verificationStatus(new URL(req.url).searchParams.get("id")));
}
