import { handle, readJson } from "@/lib/api";
import { clientKey, take } from "@/lib/rateLimit";
import { checkCode } from "@/lib/verify";

/** { id, code } → { token } */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    await take(`verify-check-ip:${clientKey(req.headers)}`, 30, 3600, "Too many tries. Please wait an hour.");
    return checkCode(body.id, body.code);
  });
}
