import { after } from "next/server";
import { handle, readJson } from "@/lib/api";
import { submitIdentity } from "@/lib/identity";
import { currentUser } from "@/lib/account";
import { alertAdmins } from "@/lib/notify";

/** Someone sends their ID for review (see lib/identity.ts). The owner is notified right away. */
export async function POST(req: Request) {
  return handle(async () => {
    const { status, notify } = await submitIdentity(await readJson(req), req.headers, await currentUser());
    after(() =>
      alertAdmins(
        notify.mode === "driver" ? "New driver to verify" : "New rider to verify",
        `${notify.name} sent their ID. Please check it within 24 hours.`,
        "/admin/verifications",
      ),
    );
    return { status };
  });
}
