import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireDb, schema as s } from "@/lib/db";
import { normalizePhone, todayLocal } from "@/lib/format";
import { checkId, cleanIdNumber, LICENSE_AUTHORITIES } from "@/lib/identityRules";
import { clientKey, take } from "@/lib/rateLimit";
import { BookingError } from "@/lib/trips";
import { requireVerifiedPhone } from "@/lib/verify";

/* ---------- Encryption of ID photos ---------- */

function docKey() {
  const secret = process.env.ID_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("ID_ENCRYPTION_KEY (or AUTH_SECRET) must be set, 32+ characters");
  return createHash("sha256").update(`hamsafar-id-docs:${secret}`).digest();
}

export function encryptDoc(bytes: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", docKey(), iv);
  const body = Buffer.concat([c.update(bytes), c.final()]);
  return Buffer.concat([iv, body, c.getAuthTag()]).toString("base64");
}

export function decryptDoc(data: string): Buffer {
  const raw = Buffer.from(data, "base64");
  const d = createDecipheriv("aes-256-gcm", docKey(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]);
}

/** A photo sent as a data URL; only real JPEG / PNG / WebP images up to 2 MB. */
function readPhoto(dataUrl: unknown, label: string): { mime: string; bytes: Buffer } {
  const m = typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) throw new BookingError(`Add a photo of ${label}.`);
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length < 2000) throw new BookingError(`The photo of ${label} is too small. Take it again.`);
  if (bytes.length > 2_000_000) throw new BookingError(`The photo of ${label} is too big.`);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 4).toString("hex") === "89504e47";
  const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!jpeg && !png && !webp) throw new BookingError(`The photo of ${label} isn't an image.`);
  return { mime: m[1], bytes };
}

/* ---------- Submitting an ID ---------- */

const ymdOrEmpty = z.string().trim().max(10).optional().default("");
export const identityInput = z.object({
  mode: z.enum(["rider", "driver"]),
  phone: z.string().trim().max(30),
  phoneToken: z.string().max(2000).optional(),
  idType: z.enum(["cnic", "bform"]).default("cnic"),
  idNumber: z.string().trim().max(20).optional().default(""),
  fullName: z.string().trim().max(80).optional().default(""),
  fatherName: z.string().trim().max(80).optional().default(""),
  gender: z.enum(["male", "female"]).optional(),
  dob: ymdOrEmpty,
  idExpiry: ymdOrEmpty,
  guardian: z.object({ name: z.string().trim().max(80).default(""), cnic: z.string().trim().max(20).default(""), relation: z.string().trim().max(30).default("") }).optional(),
  license: z.object({ number: z.string().trim().max(30).default(""), expiry: ymdOrEmpty, authority: z.string().max(20).default("") }).optional(),
  vehicleReg: z.string().trim().max(20).optional().default(""),
  consent: z.literal(true, "Please agree to the ID check to continue."),
  /** What the card scan read, to compare with what was typed. */
  scanned: z.object({ idNumber: z.string().max(20).nullish(), name: z.string().max(80).nullish() }).optional(),
  photos: z.record(z.string(), z.string().max(3_000_000)).default({}),
});

const PHOTO_LABEL = {
  cnic_front: "the front of your CNIC",
  cnic_back: "the back of your CNIC",
  selfie: "your face (selfie)",
  license: "your driving licence",
  bform: "your B-form",
  guardian_front: "the front of your parent's CNIC",
  guardian_back: "the back of your parent's CNIC",
} as const;
type DocKind = keyof typeof PHOTO_LABEL;

export type IdStatus = {
  registered: boolean;
  riderStatus: s.Identity["riderStatus"];
  driverStatus: s.Identity["driverStatus"];
  idType: s.Identity["idType"] | null;
  rejectReason: string | null;
  submittedAt: string | null;
  firstName: string | null;
};

const statusOf = (i: s.Identity | undefined): IdStatus => ({
  registered: !!i,
  riderStatus: i?.riderStatus ?? "none",
  driverStatus: i?.driverStatus ?? "none",
  idType: i?.idType ?? null,
  rejectReason: i?.rejectReason ?? null,
  submittedAt: i?.submittedAt.toISOString() ?? null,
  firstName: i?.fullName.split(" ")[0] ?? null,
});

export async function identityByPhone(phone: string) {
  const [row] = await requireDb().select().from(s.identities).where(eq(s.identities.phone, phone)).limit(1);
  return row;
}

/** What this phone has done so far (needs the phone check token once WhatsApp verification is on). */
export async function identityStatus(phoneRaw: unknown, token: unknown): Promise<IdStatus> {
  const phone = normalizePhone(String(phoneRaw ?? ""));
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");
  await requireVerifiedPhone(token, phone);
  return statusOf(await identityByPhone(phone));
}

/**
 * Saves an ID for review. Riders: CNIC front/back + selfie (under 18: B-form + parent's CNIC + selfie).
 * Drivers: the same plus driving licence and car registration. A rider who is already verified only adds the
 * licence to become a driver.
 */
export async function submitIdentity(raw: unknown, h: Headers) {
  await take(`id-submit:${clientKey(h)}`, 8, 3600, "Too many attempts. Please try again in an hour.");
  const parsed = identityInput.safeParse(raw);
  if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Check the form");
  const f = parsed.data;
  const phone = normalizePhone(f.phone);
  if (!phone) throw new BookingError("Enter a valid phone number, e.g. 0300 1234567");
  await requireVerifiedPhone(f.phoneToken, phone);
  await take(`id-submit-phone:${phone}`, 6, 3600, "Too many attempts for this number. Please try again in an hour.");
  const db = requireDb();
  const today = todayLocal();
  const existing = await identityByPhone(phone);

  const license = f.license ?? { number: "", expiry: "", authority: "" };
  const driverFields = () => {
    if (f.mode !== "driver") return {};
    if (license.number.length < 4) throw new BookingError("Enter your driving licence number.");
    if (!(license.authority in LICENSE_AUTHORITIES)) throw new BookingError("Choose where your licence was issued.");
    const reg = f.vehicleReg.toUpperCase().replace(/\s+/g, " ");
    if (reg.replace(/[^A-Z0-9]/g, "").length < 3) throw new BookingError("Enter your car's registration number, e.g. LEA-2207.");
    return { licenseNumber: license.number.toUpperCase(), licenseExpiry: license.expiry, licenseAuthority: license.authority, vehicleReg: reg };
  };

  // A verified (or waiting) rider becoming a driver: only the licence is new.
  const upgrade = f.mode === "driver" && existing && existing.idType === "cnic" && existing.riderStatus !== "rejected" && !f.photos.cnic_front;
  if (upgrade) {
    const { errors, warnings } = checkId(
      { mode: "driver", idType: "cnic", idNumber: existing.idNumber, gender: existing.gender, dob: existing.dob, idExpiry: existing.idExpiry, licenseExpiry: license.expiry },
      today,
    );
    if (errors.length) throw new BookingError(errors[0]);
    const extra = driverFields();
    const photo = readPhoto(f.photos.license, PHOTO_LABEL.license);
    await db.transaction(async (tx) => {
      await tx.delete(s.identityDocs).where(and(eq(s.identityDocs.identityId, existing.id), eq(s.identityDocs.kind, "license")));
      await tx.insert(s.identityDocs).values({ identityId: existing.id, kind: "license", mime: photo.mime, data: encryptDoc(photo.bytes) });
      await tx
        .update(s.identities)
        .set({ ...extra, driverStatus: "pending", rejectReason: null, warnings: [...new Set([...existing.warnings, ...warnings])], submittedAt: new Date() })
        .where(eq(s.identities.id, existing.id));
    });
    return { status: statusOf(await identityByPhone(phone)), notify: { mode: "driver" as const, name: existing.fullName } };
  }

  // A full submission (first time, or again after being rejected).
  if (existing && existing.riderStatus === "approved" && (f.mode === "rider" || existing.driverStatus === "approved"))
    throw new BookingError("Your ID is already verified.", 409);
  if (!f.gender) throw new BookingError("Choose male or female.");
  if (f.fullName.length < 3) throw new BookingError("Enter your full name as on your ID.");
  const idNumber = cleanIdNumber(f.idNumber);
  const { errors, warnings } = checkId(
    { mode: f.mode, idType: f.idType, idNumber: f.idNumber, gender: f.gender, dob: f.dob, idExpiry: f.idExpiry || null, guardianCnic: f.guardian?.cnic, licenseExpiry: license.expiry },
    today,
  );
  if (errors.length || !idNumber) throw new BookingError(errors[0] ?? "Check your ID number.");
  const [taken] = await db
    .select({ id: s.identities.id })
    .from(s.identities)
    .where(and(eq(s.identities.idNumber, idNumber), ne(s.identities.phone, phone)))
    .limit(1);
  if (taken) throw new BookingError("This ID number is already registered with another phone number. If that's you, tell us through Feedback.", 409);
  if (f.scanned?.idNumber && cleanIdNumber(f.scanned.idNumber) && cleanIdNumber(f.scanned.idNumber) !== idNumber)
    warnings.push("The typed ID number differs from the one read from the card photo");

  const kinds: DocKind[] =
    f.idType === "cnic" ? ["cnic_front", "cnic_back", "selfie", ...(f.mode === "driver" ? (["license"] as const) : [])] : ["bform", "guardian_front", "guardian_back", "selfie"];
  const photos = kinds.map((k) => ({ kind: k, ...readPhoto(f.photos[k], PHOTO_LABEL[k]) }));
  const guardianCnic = f.idType === "bform" ? cleanIdNumber(f.guardian?.cnic ?? "") : null;
  const values = {
    phone,
    idType: f.idType,
    idNumber,
    fullName: f.fullName.replace(/\s+/g, " "),
    fatherName: f.fatherName || null,
    gender: f.gender,
    dob: f.dob,
    idExpiry: f.idType === "cnic" ? f.idExpiry : null,
    guardianName: f.idType === "bform" ? f.guardian?.name || null : null,
    guardianCnic,
    guardianRelation: f.idType === "bform" ? f.guardian?.relation || null : null,
    ...driverFields(),
    riderStatus: "pending" as const,
    driverStatus: f.mode === "driver" ? ("pending" as const) : existing && existing.driverStatus !== "rejected" ? existing.driverStatus : ("none" as const),
    rejectReason: null,
    warnings,
    submittedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
  await db.transaction(async (tx) => {
    let id = existing?.id;
    if (id) {
      await tx.update(s.identities).set(values).where(eq(s.identities.id, id));
      await tx.delete(s.identityDocs).where(eq(s.identityDocs.identityId, id));
    } else {
      [{ id }] = await tx.insert(s.identities).values(values).returning({ id: s.identities.id });
    }
    await tx.insert(s.identityDocs).values(photos.map((p) => ({ identityId: id!, kind: p.kind, mime: p.mime, data: encryptDoc(p.bytes) })));
  });
  return { status: statusOf(await identityByPhone(phone)), notify: { mode: f.mode, name: values.fullName } };
}

/* ---------- Rules for offering and booking ---------- */

const idError = (status: IdStatus, role: "driver" | "rider", message: string, code: string) =>
  new BookingError(message, 403, { code, role, idStatus: status });

/**
 * A driver may offer rides once they've sent their ID and licence; the ride goes live when the ID is
 * approved. Returning drivers confirm with their CNIC number, which must match the one on file for this phone.
 * Returns the status the new ride should get.
 */
/** Whether a driver can offer rides: the status their rides get, and their gender from the ID. */
export async function driverGate(phone: string, cnicRaw: unknown): Promise<{ status: "active" | "pending"; gender: s.Identity["gender"] }> {
  const i = await identityByPhone(phone);
  const st = statusOf(i);
  if (!i || i.driverStatus === "none") throw idError(st, "driver", "Verify your ID and driving licence once to offer rides.", "id_required");
  if (i.driverStatus === "rejected") throw idError(st, "driver", `Your ID wasn't approved: ${i.rejectReason ?? "please send it again"}.`, "id_rejected");
  if (cleanIdNumber(String(cnicRaw ?? "")) !== i.idNumber) throw idError(st, "driver", "That CNIC number doesn't match the one registered with this phone number.", "cnic_mismatch");
  return { status: i.driverStatus === "approved" ? "active" : "pending", gender: i.gender };
}

/** Riders can book once they've sent their ID (even while it's being checked). Returns their verified gender. */
export async function riderGate(phone: string) {
  const i = await identityByPhone(phone);
  const st = statusOf(i);
  const ok = (x?: string) => x === "pending" || x === "approved";
  if (!i || (!ok(i.riderStatus) && !ok(i.driverStatus))) {
    if (i?.riderStatus === "rejected") throw idError(st, "rider", `Your ID wasn't approved: ${i.rejectReason ?? "please send it again"}.`, "id_rejected");
    throw idError(st, "rider", "Verify your ID once to book rides.", "id_required");
  }
  return { gender: i.gender };
}

/** Which of these driver phones are ID-verified (for the "ID verified" badge). */
export async function verifiedDrivers(phones: string[]) {
  if (!phones.length) return new Set<string>();
  const rows = await requireDb()
    .select({ phone: s.identities.phone })
    .from(s.identities)
    .where(and(inArray(s.identities.phone, [...new Set(phones)]), eq(s.identities.driverStatus, "approved")));
  return new Set(rows.map((r) => r.phone));
}

/* ---------- Super admin ---------- */

export async function reviewQueue(filter: "pending" | "approved" | "rejected" | "all") {
  const db = requireDb();
  const where =
    filter === "all"
      ? undefined
      : filter === "pending"
        ? or(eq(s.identities.riderStatus, "pending"), eq(s.identities.driverStatus, "pending"))
        : or(eq(s.identities.riderStatus, filter), eq(s.identities.driverStatus, filter));
  return db
    .select()
    .from(s.identities)
    .where(where)
    .orderBy(filter === "pending" ? s.identities.submittedAt : desc(s.identities.submittedAt))
    .limit(300);
}

export async function pendingCount() {
  const [{ n }] = await requireDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(s.identities)
    .where(or(eq(s.identities.riderStatus, "pending"), eq(s.identities.driverStatus, "pending")));
  return n;
}

export async function identityDetail(id: number) {
  const db = requireDb();
  const [i] = await db.select().from(s.identities).where(eq(s.identities.id, id));
  if (!i) return null;
  const [docs, rides, bookings, views] = await Promise.all([
    db.select({ id: s.identityDocs.id, kind: s.identityDocs.kind }).from(s.identityDocs).where(eq(s.identityDocs.identityId, id)),
    db.select().from(s.rides).where(eq(s.rides.driverPhone, i.phone)).orderBy(desc(s.rides.createdAt)).limit(50),
    db
      .select({ b: s.rideBookings, slug: s.rides.slug, driverName: s.rides.driverName, driverPhone: s.rides.driverPhone })
      .from(s.rideBookings)
      .innerJoin(s.rides, eq(s.rides.id, s.rideBookings.rideId))
      .where(eq(s.rideBookings.phone, i.phone))
      .orderBy(desc(s.rideBookings.date))
      .limit(100),
    db
      .select({ at: s.idAccessLog.at, kind: s.idAccessLog.docKind, admin: s.admins.email })
      .from(s.idAccessLog)
      .leftJoin(s.admins, eq(s.admins.id, s.idAccessLog.adminId))
      .where(eq(s.idAccessLog.identityId, id))
      .orderBy(desc(s.idAccessLog.at))
      .limit(20),
  ]);
  return { identity: i, docs, rides, bookings, views };
}

/** Find people by CNIC / B-form number, phone, or name (for following up an incident). */
export async function searchIdentities(q: string) {
  const digits = q.replace(/\D/g, "");
  const phone = normalizePhone(q);
  const conds = [sql`${s.identities.fullName} ilike ${"%" + q.trim() + "%"}`];
  if (digits.length >= 5) conds.push(sql`${s.identities.idNumber} like ${digits + "%"}`, sql`${s.identities.guardianCnic} like ${digits + "%"}`);
  if (phone) conds.push(eq(s.identities.phone, phone));
  return requireDb()
    .select()
    .from(s.identities)
    .where(or(...conds))
    .orderBy(desc(s.identities.submittedAt))
    .limit(50);
}

/** Approve as rider and/or driver. Approving a driver puts their waiting rides live. */
export async function approveIdentity(id: number, adminId: number) {
  const db = requireDb();
  return db.transaction(async (tx) => {
    const [i] = await tx.select().from(s.identities).where(eq(s.identities.id, id)).for("update");
    if (!i) throw new BookingError("Not found", 404);
    const driver = i.driverStatus === "pending" || i.driverStatus === "approved";
    await tx
      .update(s.identities)
      .set({ riderStatus: "approved", driverStatus: driver ? "approved" : i.driverStatus, rejectReason: null, reviewedAt: new Date(), reviewedBy: adminId })
      .where(eq(s.identities.id, id));
    const live = driver
      ? await tx
          .update(s.rides)
          .set({ status: "active" })
          .where(and(eq(s.rides.driverPhone, i.phone), eq(s.rides.status, "pending")))
          .returning({ id: s.rides.id })
      : [];
    return { phone: i.phone, name: i.fullName, ridesLive: live.length, driver };
  });
}

export async function rejectIdentity(id: number, adminId: number, reason: string) {
  const r = reason.trim().slice(0, 300) || "The photos weren't clear enough";
  const [i] = await requireDb().select().from(s.identities).where(eq(s.identities.id, id));
  if (!i) throw new BookingError("Not found", 404);
  await requireDb()
    .update(s.identities)
    .set({
      riderStatus: i.riderStatus === "approved" ? "approved" : "rejected",
      driverStatus: i.driverStatus === "none" ? "none" : "rejected",
      rejectReason: r,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    })
    .where(eq(s.identities.id, id));
}

/** Deletes a person's ID data and photos (e.g. on their request). Their rides and bookings stay. */
export async function deleteIdentity(id: number) {
  await requireDb().delete(s.identities).where(eq(s.identities.id, id));
}

/** One ID photo, decrypted, for a super admin; the view is logged. */
export async function openDoc(docId: number, adminId: number) {
  const db = requireDb();
  const [d] = await db.select().from(s.identityDocs).where(eq(s.identityDocs.id, docId));
  if (!d) return null;
  await db.insert(s.idAccessLog).values({ adminId, identityId: d.identityId, docKind: d.kind });
  return { mime: d.mime, bytes: decryptDoc(d.data) };
}
