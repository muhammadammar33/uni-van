import { handle, readJson } from "@/lib/api";
import { accountFor, phoneFor } from "@/lib/account";
import { identityByPhone, statusOf } from "@/lib/identity";

/** Setup step 1: { phone, phoneToken } → the checked number is kept on the account; returns their ID status. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await accountFor("set up your account");
    const b = await readJson(req);
    const phone = await phoneFor(user, b.phone, b.phoneToken);
    return { phone, status: statusOf(await identityByPhone(phone)) };
  });
}
