import { handle, readJson } from "@/lib/api";
import { identityStatus } from "@/lib/identity";
import { currentUser } from "@/lib/account";
import { clientKey, take } from "@/lib/rateLimit";

/** { phone, phoneToken } → where this person's ID check stands. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    await take(`id-status:${clientKey(req.headers)}`, 60, 3600, "Too many requests. Please try again in an hour.");
    return { status: await identityStatus(b.phone, b.phoneToken, await currentUser()) };
  });
}
