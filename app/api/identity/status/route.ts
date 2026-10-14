import { handle, readJson } from "@/lib/api";
import { identityStatus } from "@/lib/identity";

/** { phone, phoneToken } → where this person's ID check stands. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    return { status: await identityStatus(b.phone, b.phoneToken) };
  });
}
