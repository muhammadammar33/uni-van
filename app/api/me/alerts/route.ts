import { handle, readJson } from "@/lib/api";
import { currentUser } from "@/lib/account";
import { addRouteAlert, deleteRouteAlert } from "@/lib/routeAlerts";
import { take } from "@/lib/rateLimit";
import { BookingError } from "@/lib/trips";

/** Save a route to be notified about: { from, to, kind } (the search's own place codes). Signed-in only. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new BookingError("Sign in to get notified.", 401, { code: "signin_required" });
    await take(`route-alert:${user.id}`, 20, 3600, "Too many alerts at once. Please try again later.");
    return addRouteAlert(user, await readJson(req));
  });
}

/** Stop an alert: { id }. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) throw new BookingError("Sign in first.", 401);
    await deleteRouteAlert(user.id, Number((await readJson(req)).id));
    return { ok: true };
  });
}
