import { handle, readJson } from "@/lib/api";
import { checkCode } from "@/lib/verify";

/** { id, code } → { token } */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return checkCode(body.id, body.code);
  });
}
