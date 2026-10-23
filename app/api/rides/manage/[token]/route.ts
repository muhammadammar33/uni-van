import { handle, readJson } from "@/lib/api";
import { BookingError } from "@/lib/trips";
import { deleteRide, manageRide, setRideStatus, updateRide } from "@/lib/rides";
import { currentUser } from "@/lib/account";

export const dynamic = "force-dynamic";

/** The driver's view of their ride (secret token). */
export async function GET(_req: Request, ctx: RouteContext<"/api/rides/manage/[token]">) {
  const { token } = await ctx.params;
  return handle(async () => {
    const data = await manageRide(token);
    if (!data) throw new BookingError("Ride not found", 404);
    return data;
  });
}

/** { status } to pause / resume / cancel, or the full ride form to edit. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/rides/manage/[token]">) {
  const { token } = await ctx.params;
  return handle(async () => {
    const body = await readJson(req);
    if (typeof body.status === "string" && Object.keys(body).length === 1) {
      if (!["active", "paused", "cancelled"].includes(body.status)) throw new BookingError("Invalid status");
      await setRideStatus(token, body.status as "active" | "paused" | "cancelled");
    } else await updateRide(token, body, await currentUser());
    return { ok: true };
  });
}

/** Deletes the ride entirely (bookings included). */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/rides/manage/[token]">) {
  const { token } = await ctx.params;
  return handle(async () => {
    await deleteRide(token);
    return { ok: true };
  });
}
