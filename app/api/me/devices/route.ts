import { handle, readJson } from "@/lib/api";
import { currentUser } from "@/lib/account";
import { forgetDevice, pushEnabled, saveDevice } from "@/lib/push";
import { BookingError } from "@/lib/trips";

/** For the app: is someone signed in, and are push notifications set up on the server? */
export async function GET() {
  return handle(async () => ({ signedIn: !!(await currentUser()), push: pushEnabled() }));
}

const tokenOf = (v: unknown) => (typeof v === "string" && /^[\w:.-]{20,4096}$/.test(v) ? v : null);

/** The app registers this phone for notifications: { token, platform }. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const user = await currentUser();
    if (!user) throw new BookingError("Sign in first", 401);
    const token = tokenOf(b.token);
    if (!token) throw new BookingError("Invalid token");
    await saveDevice(user.id, token, b.platform === "ios" ? "ios" : "android");
    return { ok: true };
  });
}

/** This phone shouldn't get notifications any more (e.g. turned off in the app). */
export async function DELETE(req: Request) {
  return handle(async () => {
    const b = await readJson(req);
    const user = await currentUser();
    const token = tokenOf(b.token);
    if (user && token) await forgetDevice(token, user.id);
    return { ok: true };
  });
}
