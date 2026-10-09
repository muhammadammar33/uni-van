"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, requireAdmin, startSession } from "@/lib/auth";
import { db, requireDb, schema as s } from "@/lib/db";
import { defaultTitle } from "@/lib/format";
import { layoutConflicts, MAX_FARE, parseLayout, type Layout } from "@/lib/layout";
import { bookSeat, BookingError, loadTrip, markBooking, newDriverToken, newSlug, takenSeats } from "@/lib/trips";

export type FormState = { error?: string; ok?: string } | undefined;

const errorMessage = (err: unknown) =>
  err instanceof z.ZodError ? (err.issues[0]?.message ?? "Check the form") : err instanceof BookingError ? err.message : null;

/* ---------- Auth ---------- */

export async function login(_: FormState, form: FormData): Promise<FormState> {
  if (!db) return { error: "The database is not configured (DATABASE_URL)." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [admin] = await db.select().from(s.admins).where(eq(s.admins.email, email)).limit(1);
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return { error: "Wrong email or password." };
  await startSession(admin);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const [row] = await requireDb().select().from(s.admins).where(eq(s.admins.id, me.id));
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) return { error: "Current password is wrong." };
  await requireDb().update(s.admins).set({ passwordHash: await bcrypt.hash(next, 12) }).where(eq(s.admins.id, me.id));
  return { ok: "Password changed." };
}

export async function addAdmin(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Enter a name"),
      email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
      password: z.string().min(8, "Password must be at least 8 characters"),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { name, email, password } = parsed.data;
  const inserted = await requireDb()
    .insert(s.admins)
    .values({ name, email, passwordHash: await bcrypt.hash(password, 12) })
    .onConflictDoNothing()
    .returning({ id: s.admins.id });
  if (!inserted.length) return { error: "An admin with that email already exists." };
  revalidatePath("/admin/account");
  return { ok: `${name} can now sign in.` };
}

export async function removeAdmin(id: number) {
  const me = await requireAdmin();
  if (id === me.id) return;
  await requireDb().delete(s.admins).where(eq(s.admins.id, id));
  revalidatePath("/admin/account");
}

/* ---------- Trips ---------- */

const time = z.string().regex(/^\d{2}:\d{2}$/, "Enter a time for every stop");
const stopSchema = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1, "Every stop needs a name").max(80), time });

const tripSchema = z.object({
  title: z.string().trim().max(100),
  direction: z.enum(["to_uni", "to_home"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  departTime: z.union([time, z.literal("")]),
  closesAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), z.literal("")]),
  notes: z.string().trim().max(1000),
  fare: z.union([z.literal(""), z.coerce.number().int("Fare must be a whole number").min(0, "Fare can't be negative").max(MAX_FARE)]),
  stops: z.array(stopSchema).min(1, "Add at least one stop"),
});

function readTripForm(form: FormData) {
  let stops: unknown = [];
  try {
    stops = JSON.parse(String(form.get("stops") ?? "[]"));
  } catch {}
  const data = tripSchema.parse({
    title: form.get("title") ?? "",
    direction: form.get("direction"),
    date: form.get("date"),
    departTime: form.get("departTime") ?? "",
    closesAt: form.get("closesAt") ?? "",
    notes: form.get("notes") ?? "",
    fare: String(form.get("fare") ?? "").trim(),
    stops,
  });
  return {
    fields: {
      title: data.title || defaultTitle(data.direction, data.date),
      direction: data.direction,
      date: data.date,
      departTime: data.departTime || null,
      closesAt: data.closesAt || null,
      notes: data.notes || null,
      fare: data.fare === "" ? null : data.fare,
    },
    stops: data.stops,
  };
}

export async function createTrip(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const database = requireDb();
  let id: number;
  try {
    const { fields, stops } = readTripForm(form);
    const vehicleId = Number(form.get("vehicleId"));
    const [vehicle] = await database.select().from(s.vehicles).where(eq(s.vehicles.id, vehicleId));
    if (!vehicle) return { error: "Choose a vehicle" };
    id = await database.transaction(async (tx) => {
      const [trip] = await tx
        .insert(s.trips)
        .values({ ...fields, slug: newSlug(), driverToken: newDriverToken(), vehicleName: vehicle.name, layout: vehicle.layout })
        .returning({ id: s.trips.id });
      await tx.insert(s.stops).values(stops.map((st, i) => ({ tripId: trip.id, name: st.name, time: st.time, sortOrder: i })));
      return trip.id;
    });
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/admin");
  redirect(`/admin/trips/${id}`);
}

export async function updateTrip(id: number, _: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  try {
    const { fields, stops } = readTripForm(form);
    await requireDb().transaction(async (tx) => {
      await tx.update(s.trips).set(fields).where(eq(s.trips.id, id));
      const keep = stops.flatMap((st) => (st.id ? [st.id] : []));
      // Removed stops must not have passengers.
      const removed = await tx
        .select({ id: s.stops.id, name: s.stops.name })
        .from(s.stops)
        .where(and(eq(s.stops.tripId, id), keep.length ? notInArray(s.stops.id, keep) : undefined));
      if (removed.length) {
        const used = await tx
          .select({ stopId: s.bookings.stopId })
          .from(s.bookings)
          .where(inArray(s.bookings.stopId, removed.map((r) => r.id)))
          .limit(1);
        if (used.length) {
          const name = removed.find((r) => r.id === used[0].stopId)?.name;
          throw new BookingError(`"${name}" has passengers, so it can't be removed. Move or remove them first.`);
        }
        await tx.delete(s.stops).where(inArray(s.stops.id, removed.map((r) => r.id)));
      }
      for (const [i, st] of stops.entries()) {
        if (st.id) await tx.update(s.stops).set({ name: st.name, time: st.time, sortOrder: i }).where(and(eq(s.stops.id, st.id), eq(s.stops.tripId, id)));
        else await tx.insert(s.stops).values({ tripId: id, name: st.name, time: st.time, sortOrder: i });
      }
    });
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/trips/${id}`);
}

export async function setTripStatus(id: number, status: "open" | "closed") {
  await requireAdmin();
  await requireDb().update(s.trips).set({ status }).where(eq(s.trips.id, id));
  revalidatePath("/admin", "layout");
}

/** New driver link: the old one stops working (e.g. a different driver today). */
export async function resetDriverLink(id: number) {
  await requireAdmin();
  await requireDb().update(s.trips).set({ driverToken: newDriverToken() }).where(eq(s.trips.id, id));
  revalidatePath(`/admin/trips/${id}`);
}

export async function deleteTrip(id: number) {
  await requireAdmin();
  await requireDb().delete(s.trips).where(eq(s.trips.id, id));
  revalidatePath("/admin");
  redirect("/admin");
}

/** Copies a trip (stops, seating, notes) to a new date. `reverse` makes the return trip: direction flipped, stops in reverse order. */
export async function duplicateTrip(id: number, _: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date" };
  const reverse = form.get("reverse") === "on";
  const data = await loadTrip({ id });
  if (!data) return { error: "Trip not found" };
  const { trip, stops } = data;
  const direction = reverse ? (trip.direction === "to_uni" ? "to_home" : "to_uni") : trip.direction;
  const autoTitle = trip.title === defaultTitle(trip.direction, trip.date);
  const ordered = reverse ? [...stops].reverse() : stops;
  const newId = await requireDb().transaction(async (tx) => {
    const [copy] = await tx
      .insert(s.trips)
      .values({
        slug: newSlug(),
        driverToken: newDriverToken(),
        fare: trip.fare,
        title: autoTitle || reverse ? defaultTitle(direction, date) : trip.title,
        direction,
        date,
        departTime: reverse ? null : trip.departTime,
        vehicleName: trip.vehicleName,
        layout: trip.layout,
        notes: trip.notes,
        // Keep the same closing time of day, on the new date.
        closesAt: trip.closesAt && !reverse ? `${date}${trip.closesAt.slice(10)}` : null,
      })
      .returning({ id: s.trips.id });
    if (ordered.length)
      await tx.insert(s.stops).values(ordered.map((st, i) => ({ tripId: copy.id, name: st.name, time: st.time, sortOrder: i })));
    return copy.id;
  });
  revalidatePath("/admin");
  // A reversed trip needs new times, so go straight to editing it.
  redirect(reverse ? `/admin/trips/${newId}/edit` : `/admin/trips/${newId}`);
}

/* ---------- Seating ---------- */

export async function saveTripLayout(id: number, layoutJson: string): Promise<FormState> {
  await requireAdmin();
  try {
    const layout = parseLayout(JSON.parse(layoutJson));
    await requireDb().transaction(async (tx) => {
      const [trip] = await tx.select().from(s.trips).where(eq(s.trips.id, id)).for("update");
      if (!trip) throw new BookingError("Trip not found");
      const booked = await tx.select().from(s.bookings).where(eq(s.bookings.tripId, id));
      const problems = layoutConflicts(layout, takenSeats(booked), trip.layout);
      if (problems.length) throw new BookingError(problems.join(" "));
      await tx.update(s.trips).set({ layout }).where(eq(s.trips.id, id));
    });
  } catch (err) {
    const msg = errorMessage(err) ?? (err instanceof SyntaxError ? "Invalid layout" : null);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/admin", "layout");
  return { ok: "Seating saved." };
}

export async function saveVehicle(id: number | null, layoutJson: string, name: string): Promise<FormState> {
  await requireAdmin();
  let layout: Layout;
  try {
    layout = parseLayout(JSON.parse(layoutJson));
  } catch (err) {
    return { error: errorMessage(err) ?? "Invalid layout" };
  }
  const clean = name.trim();
  if (!clean) return { error: "Give the vehicle a name" };
  const database = requireDb();
  if (id) await database.update(s.vehicles).set({ name: clean, layout }).where(eq(s.vehicles.id, id));
  else {
    await database.insert(s.vehicles).values({ name: clean, layout });
    revalidatePath("/admin/vehicles");
    redirect("/admin/vehicles");
  }
  revalidatePath("/admin/vehicles");
  return { ok: "Vehicle saved." };
}

export async function deleteVehicle(id: number) {
  await requireAdmin();
  await requireDb().delete(s.vehicles).where(eq(s.vehicles.id, id));
  revalidatePath("/admin/vehicles");
  redirect("/admin/vehicles");
}

/* ---------- Bookings ---------- */

export async function adminBook(tripId: number, input: Record<string, unknown>): Promise<FormState> {
  await requireAdmin();
  try {
    const b = await bookSeat({ id: tripId }, input, true);
    revalidatePath(`/admin/trips/${tripId}`);
    return { ok: `Seat ${b.seatLabel} booked for ${b.name}.` };
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
}

export async function removeBooking(tripId: number, bookingId: number) {
  await requireAdmin();
  await requireDb().delete(s.bookings).where(and(eq(s.bookings.id, bookingId), eq(s.bookings.tripId, tripId)));
  revalidatePath(`/admin/trips/${tripId}`);
}

export async function setBookingFlag(tripId: number, bookingId: number, field: "boarded" | "paid", value: boolean) {
  await requireAdmin();
  await markBooking({ id: tripId }, { bookingId, field, value });
  revalidatePath(`/admin/trips/${tripId}`);
}
