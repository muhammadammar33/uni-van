"use server";

import bcrypt from "bcryptjs";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { endSession, ORG_COOKIE, requireAdmin, requireOrg, requireSuper, startSession } from "@/lib/auth";
import { db, requireDb, schema as s } from "@/lib/db";
import { defaultTitle, normalizePhone } from "@/lib/format";
import { busLayout, GENDERS, hiaceLayout, layoutConflicts, MAX_FARE, parseLayout, type Layout } from "@/lib/layout";
import { ORG_TYPES, orgInfo, slugify } from "@/lib/orgTypes";
import { readRiderRows } from "@/lib/riders";
import { bookSeat, BookingError, loadTrip, markBooking, newDriverToken, newSlug, takenSeats } from "@/lib/trips";

export type FormState = { error?: string; ok?: string } | undefined;

const errorMessage = (err: unknown) =>
  err instanceof z.ZodError ? (err.issues[0]?.message ?? "Check the form") : err instanceof BookingError ? err.message : null;

/** The trip, if it belongs to the organisation the admin is working in; otherwise a 404. */
async function ownTrip(id: number) {
  const { org } = await requireOrg();
  const [trip] = await requireDb()
    .select()
    .from(s.trips)
    .where(and(eq(s.trips.id, id), eq(s.trips.orgId, org.id)))
    .limit(1);
  if (!trip) notFound();
  return { trip, org };
}

async function ownVehicle(id: number) {
  const { org } = await requireOrg();
  const [vehicle] = await requireDb()
    .select()
    .from(s.vehicles)
    .where(and(eq(s.vehicles.id, id), eq(s.vehicles.orgId, org.id)))
    .limit(1);
  if (!vehicle) notFound();
  return { vehicle, org };
}

/* ---------- Auth ---------- */

export async function login(_: FormState, form: FormData): Promise<FormState> {
  if (!db) return { error: "The database is not configured (DATABASE_URL)." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [row] = await db
    .select({ admin: s.admins, orgActive: s.organizations.active })
    .from(s.admins)
    .leftJoin(s.organizations, eq(s.organizations.id, s.admins.orgId))
    .where(eq(s.admins.email, email))
    .limit(1);
  if (!row || !(await bcrypt.compare(password, row.admin.passwordHash))) return { error: "Wrong email or password." };
  if (row.admin.role !== "super" && row.orgActive === false) return { error: "This account is switched off. Contact Hamsafar support." };
  await startSession(row.admin);
  const next = String(form.get("next") ?? "");
  // Super admins start from the organisations list (they pick one to work in).
  redirect(next.startsWith("/admin") ? next : row.admin.role === "super" ? "/admin/orgs" : "/admin");
}

export async function logout() {
  await endSession();
  (await cookies()).delete(ORG_COOKIE);
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

const newAdminSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  email: z.email("Enter a valid email").transform((e) => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function insertAdmin(values: z.infer<typeof newAdminSchema> & { role: "super" | "admin"; orgId: number | null }) {
  const inserted = await requireDb()
    .insert(s.admins)
    .values({ name: values.name, email: values.email, role: values.role, orgId: values.orgId, passwordHash: await bcrypt.hash(values.password, 12) })
    .onConflictDoNothing()
    .returning({ id: s.admins.id });
  return inserted.length > 0;
}

/** Adds an admin to the organisation being worked in (organisation admins can add their own team). */
export async function addAdmin(_: FormState, form: FormData): Promise<FormState> {
  const { org } = await requireOrg();
  const parsed = newAdminSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await insertAdmin({ ...parsed.data, role: "admin", orgId: org.id }))) return { error: "An admin with that email already exists." };
  revalidatePath("/admin", "layout");
  return { ok: `${parsed.data.name} can now sign in to ${org.name}.` };
}

/** Super admins only: another person who runs the whole platform. */
export async function addSuperAdmin(_: FormState, form: FormData): Promise<FormState> {
  await requireSuper();
  const parsed = newAdminSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (!(await insertAdmin({ ...parsed.data, role: "super", orgId: null }))) return { error: "An admin with that email already exists." };
  revalidatePath("/admin", "layout");
  return { ok: `${parsed.data.name} is now a super admin.` };
}

export async function removeAdmin(id: number) {
  const me = await requireAdmin();
  if (id === me.id) return;
  const [target] = await requireDb().select().from(s.admins).where(eq(s.admins.id, id));
  if (!target) return;
  // Organisation admins may only remove their own organisation's admins.
  if (me.role !== "super" && (target.role === "super" || target.orgId !== me.orgId)) return;
  await requireDb().delete(s.admins).where(eq(s.admins.id, id));
  revalidatePath("/admin", "layout");
}

/* ---------- Organisations (super admin) ---------- */

const orgSchema = z.object({
  name: z.string().trim().min(2, "Enter the organisation's name").max(80),
  type: z.enum(ORG_TYPES),
  city: z.string().trim().max(60),
  phone: z.string().trim().max(30),
});

function readOrgForm(form: FormData) {
  const data = orgSchema.parse({ name: form.get("name") ?? "", type: form.get("type"), city: form.get("city") ?? "", phone: form.get("phone") ?? "" });
  const phone = data.phone ? normalizePhone(data.phone) : null;
  if (data.phone && !phone) throw new BookingError("Enter a valid contact phone number");
  return { name: data.name, type: data.type, city: data.city || null, phone };
}

async function uniqueOrgSlug(name: string) {
  const base = slugify(name);
  const taken = await requireDb()
    .select({ slug: s.organizations.slug })
    .from(s.organizations)
    .where(sql`${s.organizations.slug} = ${base} or ${s.organizations.slug} like ${base + "-%"}`);
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function createOrg(_: FormState, form: FormData): Promise<FormState> {
  await requireSuper();
  let orgId: number;
  try {
    const fields = readOrgForm(form);
    const admin = newAdminSchema.safeParse({ name: form.get("adminName"), email: form.get("adminEmail"), password: form.get("adminPassword") });
    if (!admin.success) return { error: `First admin: ${admin.error.issues[0]?.message}` };
    const [clash] = await requireDb().select({ id: s.admins.id }).from(s.admins).where(eq(s.admins.email, admin.data.email));
    if (clash) return { error: "An admin with that email already exists." };
    const slug = await uniqueOrgSlug(fields.name);
    orgId = await requireDb().transaction(async (tx) => {
      const [org] = await tx.insert(s.organizations).values({ ...fields, slug }).returning({ id: s.organizations.id });
      // Every organisation starts with the two common vehicles; they can edit or add their own.
      await tx.insert(s.vehicles).values([
        { orgId: org.id, name: "Toyota Hiace (15 seats)", layout: hiaceLayout() },
        { orgId: org.id, name: "Coaster (29 seats)", layout: busLayout(6) },
      ]);
      await tx.insert(s.admins).values({
        name: admin.data.name,
        email: admin.data.email,
        role: "admin",
        orgId: org.id,
        passwordHash: await bcrypt.hash(admin.data.password, 12),
      });
      return org.id;
    });
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/orgs/${orgId}`);
}

export async function updateOrg(id: number, _: FormState, form: FormData): Promise<FormState> {
  await requireSuper();
  try {
    await requireDb().update(s.organizations).set(readOrgForm(form)).where(eq(s.organizations.id, id));
  } catch (err) {
    const msg = errorMessage(err);
    if (msg) return { error: msg };
    throw err;
  }
  revalidatePath("/admin", "layout");
  return { ok: "Saved." };
}

export async function setOrgActive(id: number, active: boolean) {
  await requireSuper();
  await requireDb().update(s.organizations).set({ active }).where(eq(s.organizations.id, id));
  revalidatePath("/admin", "layout");
}

/** Deletes an organisation with everything in it: trips, bookings, vehicles, riders, its admins. */
export async function deleteOrg(id: number) {
  await requireSuper();
  await requireDb().delete(s.organizations).where(eq(s.organizations.id, id));
  const jar = await cookies();
  if (jar.get(ORG_COOKIE)?.value === String(id)) jar.delete(ORG_COOKIE);
  revalidatePath("/admin", "layout");
  redirect("/admin/orgs");
}

/** Super admin: work inside an organisation's dashboard. */
export async function openOrg(id: number) {
  await requireSuper();
  (await cookies()).set(ORG_COOKIE, String(id), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  redirect("/admin");
}

export async function leaveOrg() {
  await requireSuper();
  (await cookies()).delete(ORG_COOKIE);
  redirect("/admin/orgs");
}

/* ---------- Trips ---------- */

const time = z.string().regex(/^\d{2}:\d{2}$/, "Enter a time for every stop");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const stopSchema = z.object({ id: z.number().int().positive().optional(), name: z.string().trim().min(1, "Every stop needs a name").max(80), time });

const tripSchema = z.object({
  title: z.string().trim().max(100),
  direction: z.enum(["to_uni", "to_home"]),
  date: ymd,
  endDate: z.union([ymd, z.literal("")]),
  departTime: z.union([time, z.literal("")]),
  closesAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/), z.literal("")]),
  notes: z.string().trim().max(3000),
  fare: z.union([z.literal(""), z.coerce.number().int("Fare must be a whole number").min(0, "Fare can't be negative").max(MAX_FARE)]),
  genderRule: z.enum(["separate", "none"]),
  maxSeats: z.coerce.number().int().min(1).max(12),
  membersOnly: z.boolean(),
  stops: z.array(stopSchema).min(1, "Add at least one stop"),
});

function readTripForm(form: FormData, orgType: s.Organization["type"]) {
  let stops: unknown = [];
  try {
    stops = JSON.parse(String(form.get("stops") ?? "[]"));
  } catch {}
  const data = tripSchema.parse({
    title: form.get("title") ?? "",
    direction: form.get("direction"),
    date: form.get("date"),
    endDate: form.get("endDate") ?? "",
    departTime: form.get("departTime") ?? "",
    closesAt: form.get("closesAt") ?? "",
    notes: form.get("notes") ?? "",
    fare: String(form.get("fare") ?? "").trim(),
    genderRule: form.get("genderRule") ?? orgInfo(orgType).defaults.genderRule,
    maxSeats: form.get("maxSeats") ?? 1,
    membersOnly: form.get("membersOnly") === "on",
    stops,
  });
  if (data.endDate && data.endDate < data.date) throw new BookingError("The end date can't be before the start date");
  return {
    fields: {
      title: data.title || defaultTitle(data.direction, data.date, orgType),
      direction: data.direction,
      date: data.date,
      endDate: data.endDate && data.endDate !== data.date ? data.endDate : null,
      departTime: data.departTime || null,
      closesAt: data.closesAt || null,
      notes: data.notes || null,
      fare: data.fare === "" ? null : data.fare,
      genderRule: data.genderRule,
      // Several seats per person only makes sense without the male/female rule (one gender per booking).
      maxSeats: data.genderRule === "none" ? data.maxSeats : 1,
      membersOnly: orgInfo(orgType).roster ? data.membersOnly : false,
    },
    stops: data.stops,
  };
}

export async function createTrip(_: FormState, form: FormData): Promise<FormState> {
  const { org } = await requireOrg();
  const database = requireDb();
  let id: number;
  try {
    const { fields, stops } = readTripForm(form, org.type);
    const vehicleId = Number(form.get("vehicleId"));
    const [vehicle] = await database
      .select()
      .from(s.vehicles)
      .where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.orgId, org.id)));
    if (!vehicle) return { error: "Choose a vehicle" };
    id = await database.transaction(async (tx) => {
      const [trip] = await tx
        .insert(s.trips)
        .values({ ...fields, orgId: org.id, slug: newSlug(), driverToken: newDriverToken(), vehicleName: vehicle.name, layout: vehicle.layout })
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
  const { org } = await ownTrip(id);
  try {
    const { fields, stops } = readTripForm(form, org.type);
    await requireDb().transaction(async (tx) => {
      const booked = await tx.select().from(s.bookings).where(eq(s.bookings.tripId, id));
      if (fields.genderRule === "separate" && booked.some((b) => !b.gender))
        throw new BookingError("Some passengers booked without giving their gender, so the male/female rule can't be switched on for this trip.");
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
  await ownTrip(id);
  await requireDb().update(s.trips).set({ status }).where(eq(s.trips.id, id));
  revalidatePath("/admin", "layout");
}

/** New driver link: the old one stops working (e.g. a different driver today). */
export async function resetDriverLink(id: number) {
  await ownTrip(id);
  await requireDb().update(s.trips).set({ driverToken: newDriverToken() }).where(eq(s.trips.id, id));
  revalidatePath(`/admin/trips/${id}`);
}

export async function deleteTrip(id: number) {
  await ownTrip(id);
  await requireDb().delete(s.trips).where(eq(s.trips.id, id));
  revalidatePath("/admin");
  redirect("/admin");
}

/** Copies a trip (stops, seating, notes, rules) to a new date. `reverse` makes the return trip: direction flipped, stops in reverse order. */
export async function duplicateTrip(id: number, _: FormState, form: FormData): Promise<FormState> {
  const { org } = await ownTrip(id);
  const date = String(form.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date" };
  const reverse = form.get("reverse") === "on";
  const data = await loadTrip({ id });
  if (!data) return { error: "Trip not found" };
  const { trip, stops } = data;
  const direction = reverse ? (trip.direction === "to_uni" ? "to_home" : "to_uni") : trip.direction;
  const autoTitle = trip.title === defaultTitle(trip.direction, trip.date, org.type) || trip.title === defaultTitle(trip.direction, trip.date);
  const ordered = reverse ? [...stops].reverse() : stops;
  // Multi-day trips keep their length.
  const days = trip.endDate ? Math.round((Date.parse(trip.endDate) - Date.parse(trip.date)) / 864e5) : 0;
  const endDate = days > 0 && !reverse ? new Date(Date.parse(date) + days * 864e5).toISOString().slice(0, 10) : null;
  const newId = await requireDb().transaction(async (tx) => {
    const [copy] = await tx
      .insert(s.trips)
      .values({
        orgId: trip.orgId,
        slug: newSlug(),
        driverToken: newDriverToken(),
        fare: trip.fare,
        title: autoTitle || reverse ? defaultTitle(direction, date, org.type) : trip.title,
        direction,
        date,
        endDate,
        departTime: reverse ? null : trip.departTime,
        vehicleName: trip.vehicleName,
        layout: trip.layout,
        notes: trip.notes,
        genderRule: trip.genderRule,
        maxSeats: trip.maxSeats,
        membersOnly: trip.membersOnly,
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
  await ownTrip(id);
  try {
    const layout = parseLayout(JSON.parse(layoutJson));
    await requireDb().transaction(async (tx) => {
      const [trip] = await tx.select().from(s.trips).where(eq(s.trips.id, id)).for("update");
      if (!trip) throw new BookingError("Trip not found");
      const booked = await tx.select().from(s.bookings).where(eq(s.bookings.tripId, id));
      const problems = layoutConflicts(layout, takenSeats(booked), trip.layout, trip.genderRule);
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
  const { org } = id ? await ownVehicle(id) : await requireOrg();
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
    await database.insert(s.vehicles).values({ orgId: org.id, name: clean, layout });
    revalidatePath("/admin/vehicles");
    redirect("/admin/vehicles");
  }
  revalidatePath("/admin/vehicles");
  return { ok: "Vehicle saved." };
}

export async function deleteVehicle(id: number) {
  await ownVehicle(id);
  await requireDb().delete(s.vehicles).where(eq(s.vehicles.id, id));
  revalidatePath("/admin/vehicles");
  redirect("/admin/vehicles");
}

/* ---------- Bookings ---------- */

export async function adminBook(tripId: number, input: Record<string, unknown>): Promise<FormState> {
  await ownTrip(tripId);
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
  await ownTrip(tripId);
  await requireDb().delete(s.bookings).where(and(eq(s.bookings.id, bookingId), eq(s.bookings.tripId, tripId)));
  revalidatePath(`/admin/trips/${tripId}`);
}

export async function setBookingFlag(tripId: number, bookingId: number, field: "boarded" | "paid", value: boolean) {
  await ownTrip(tripId);
  await markBooking({ id: tripId }, { bookingId, field, value });
  revalidatePath(`/admin/trips/${tripId}`);
}

/* ---------- Registered riders (institutions, companies) ---------- */

const riderSchema = z.object({
  name: z.string().trim().min(2, "Enter the name").max(80),
  phone: z.string().trim().max(30),
  gender: z.enum(GENDERS, "Choose male or female"),
  refNo: z.string().trim().max(40),
  groupName: z.string().trim().max(80),
  stop: z.string().trim().max(80),
});

export async function saveRider(id: number | null, _: FormState, form: FormData): Promise<FormState> {
  const { org } = await requireOrg();
  const parsed = riderSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Enter a valid phone number, e.g. 0300 1234567" };
  const values = {
    name: parsed.data.name,
    phone,
    gender: parsed.data.gender,
    refNo: parsed.data.refNo || null,
    groupName: parsed.data.groupName || null,
    stop: parsed.data.stop || null,
  };
  const database = requireDb();
  const [dupe] = await database
    .select({ id: s.riders.id, name: s.riders.name })
    .from(s.riders)
    .where(and(eq(s.riders.orgId, org.id), eq(s.riders.phone, phone)));
  if (dupe && dupe.id !== id) return { error: `${dupe.name} is already registered with this phone number.` };
  if (id) await database.update(s.riders).set(values).where(and(eq(s.riders.id, id), eq(s.riders.orgId, org.id)));
  else await database.insert(s.riders).values({ ...values, orgId: org.id });
  revalidatePath("/admin/riders");
  return { ok: id ? `${values.name} updated.` : `${values.name} added.` };
}

export async function setRiderActive(id: number, active: boolean) {
  const { org } = await requireOrg();
  await requireDb()
    .update(s.riders)
    .set({ active })
    .where(and(eq(s.riders.id, id), eq(s.riders.orgId, org.id)));
  revalidatePath("/admin/riders");
}

export async function deleteRider(id: number) {
  const { org } = await requireOrg();
  await requireDb()
    .delete(s.riders)
    .where(and(eq(s.riders.id, id), eq(s.riders.orgId, org.id)));
  revalidatePath("/admin/riders");
}

export type ImportResult = { added: number; updated: number; problems: { row: number; message: string }[] } | { error: string };

/**
 * Imports a spreadsheet (already read into rows in the browser). Riders are matched by phone: new phones are
 * added, known phones updated. Nothing is deleted.
 */
export async function importRiders(table: unknown[][]): Promise<ImportResult> {
  const { org } = await requireOrg();
  if (!Array.isArray(table) || table.length > 20001) return { error: "The file is too large (20,000 rows at most)." };
  const { riders, problems, missing } = readRiderRows(table);
  if (missing.length) return { error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Download the template to see the layout.` };
  if (!riders.length) return { added: 0, updated: 0, problems };
  const database = requireDb();
  const existing = await database
    .select({ phone: s.riders.phone })
    .from(s.riders)
    .where(and(eq(s.riders.orgId, org.id), inArray(s.riders.phone, riders.map((r) => r.phone))));
  const known = new Set(existing.map((e) => e.phone));
  for (let i = 0; i < riders.length; i += 500) {
    await database
      .insert(s.riders)
      .values(riders.slice(i, i + 500).map((r) => ({ ...r, orgId: org.id, active: true })))
      .onConflictDoUpdate({
        target: [s.riders.orgId, s.riders.phone],
        set: {
          name: sql`excluded.name`,
          gender: sql`excluded.gender`,
          refNo: sql`excluded.ref_no`,
          groupName: sql`excluded.group_name`,
          stop: sql`excluded.stop`,
          active: true,
        },
      });
  }
  revalidatePath("/admin/riders");
  const updated = riders.filter((r) => known.has(r.phone)).length;
  return { added: riders.length - updated, updated, problems };
}
