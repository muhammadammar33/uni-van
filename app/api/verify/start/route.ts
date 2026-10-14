import { handle, readJson } from "@/lib/api";
import { startVerification } from "@/lib/verify";

/** { phone, method: "send" | "message" } → { required, id, ... } */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    return startVerification(body.phone, body.method, req.headers);
  });
}
