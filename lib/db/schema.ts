import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Layout } from "../layout";

export const directionEnum = pgEnum("trip_direction", ["to_uni", "to_home"]);
export const tripStatusEnum = pgEnum("trip_status", ["open", "closed"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
/** What kind of client an organisation is: decides wording and default booking rules (see lib/orgTypes.ts). */
export const orgTypeEnum = pgEnum("org_type", ["transport", "institution", "tour", "company"]);
export const adminRoleEnum = pgEnum("admin_role", ["super", "admin"]);
/** "separate": males and females never side by side. "none": anyone anywhere (families, tours). */
export const genderRuleEnum = pgEnum("gender_rule", ["separate", "none"]);

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

/** A client of the platform: a van operator, a university, a tour company... Everything else belongs to one. */
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  /** Public page: /o/<slug> */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: orgTypeEnum("type").notNull(),
  city: text("city"),
  /** Digits with country code, shown to passengers as the contact number. */
  phone: text("phone"),
  /** Switched off by the super admin: no sign-in for its admins and no new bookings. */
  active: boolean("active").default(true).notNull(),
  createdAt,
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  /** super: runs the platform and every organisation. admin: runs one organisation. */
  role: adminRoleEnum("role").default("admin").notNull(),
  orgId: integer("org_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdAt,
});

/** Registered riders of an institution or company (students, staff), imported from CSV/Excel or added by hand. */
export const riders = pgTable(
  "riders",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Digits with country code; how a rider identifies themselves when booking. */
    phone: text("phone").notNull(),
    gender: genderEnum("gender").notNull(),
    /** Roll number / employee ID. When set, the rider must give it with their phone to book. */
    refNo: text("ref_no"),
    /** Class, department or programme, free text. */
    groupName: text("group_name"),
    /** Usual stop, for the admin's reference. */
    stop: text("stop"),
    active: boolean("active").default(true).notNull(),
    createdAt,
  },
  (t) => [uniqueIndex("riders_org_phone_uq").on(t.orgId, t.phone), index("riders_org_idx").on(t.orgId)],
);

/** Saved seating plans (a Hiace, a Coaster...) that trips copy their layout from. */
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  layout: jsonb("layout").$type<Layout>().notNull(),
  createdAt,
});

export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    orgId: integer("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    /** Random id used in the public link: /t/<slug> */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    direction: directionEnum("direction").notNull(),
    /** Local date, "YYYY-MM-DD" */
    date: text("date").notNull(),
    /** Last day of a multi-day trip (tours), "YYYY-MM-DD"; null for same-day trips. */
    endDate: text("end_date"),
    /** Local "HH:MM" the van leaves (from the university on trips home); optional. */
    departTime: text("depart_time"),
    vehicleName: text("vehicle_name").notNull(),
    /** The trip's own copy of the seating plan, so editing a saved vehicle never moves booked seats. */
    layout: jsonb("layout").$type<Layout>().notNull(),
    /** Fare per seat in whole rupees; a seat can override it in the layout. Null = no fare shown. */
    fare: integer("fare"),
    /** Secret for the driver's view: /d/<driverToken> */
    driverToken: text("driver_token").notNull().unique(),
    status: tripStatusEnum("status").default("open").notNull(),
    /** Local "YYYY-MM-DDTHH:MM" after which booking stops; null = until the admin closes it. */
    closesAt: text("closes_at"),
    notes: text("notes"),
    genderRule: genderRuleEnum("gender_rule").default("separate").notNull(),
    /** Seats one person may book at once (a family on a tour). More than 1 only with genderRule "none". */
    maxSeats: integer("max_seats").default(1).notNull(),
    /** Only the organisation's registered riders can book (institutions, companies). */
    membersOnly: boolean("members_only").default(false).notNull(),
    createdAt,
  },
  (t) => [index("trips_date_idx").on(t.date), index("trips_org_idx").on(t.orgId)],
);

export const stops = pgTable(
  "stops",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Local "HH:MM": pickup time going to university, drop-off time going home. */
    time: text("time").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (t) => [index("stops_trip_idx").on(t.tripId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    tripId: integer("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    stopId: integer("stop_id").notNull().references(() => stops.id, { onDelete: "restrict" }),
    seatId: text("seat_id").notNull(),
    name: text("name").notNull(),
    /** Digits with country code, e.g. 923001234567 */
    phone: text("phone").notNull(),
    /** Null on trips without a seating rule, where gender isn't asked. */
    gender: genderEnum("gender"),
    /** The registered rider who booked (institutions, companies). */
    riderId: integer("rider_id").references(() => riders.id, { onDelete: "set null" }),
    /** Short code the passenger uses to look up or cancel their booking; shared by seats booked together. */
    code: text("code").notNull(),
    /** Fare for this seat when it was booked, so later fare changes don't alter what the passenger was told. */
    fare: integer("fare"),
    boarded: boolean("boarded").default(false).notNull(),
    paid: boolean("paid").default(false).notNull(),
    createdAt,
  },
  (t) => [uniqueIndex("bookings_trip_seat_uq").on(t.tripId, t.seatId), index("bookings_trip_phone_idx").on(t.tripId, t.phone)],
);

export type Organization = typeof organizations.$inferSelect;
export type Rider = typeof riders.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type Stop = typeof stops.$inferSelect;
export type Booking = typeof bookings.$inferSelect;

/* ---------- Carpool ---------- */

export const rideScheduleEnum = pgEnum("ride_schedule", ["once", "daily", "weekly"]);
/** "pending": saved, but waits until the driver's ID is approved (then it goes live by itself). */
export const rideStatusEnum = pgEnum("ride_status", ["active", "paused", "cancelled", "pending"]);
/** "city": within the Islamabad area. "intercity": between cities anywhere in Pakistan. */
export const rideKindEnum = pgEnum("ride_kind", ["city", "intercity"]);
/** Who may ride: anyone, or only women / only men (e.g. a female driver taking female passengers). */
export const rideRidersEnum = pgEnum("ride_riders", ["anyone", "female", "male"]);

/** A carpool ride offered by a driver, without an account. The driver manages it through /r/manage/<manageToken>. */
export const rides = pgTable(
  "rides",
  {
    id: serial("id").primaryKey(),
    /** Public link: /r/<slug> */
    slug: text("slug").notNull().unique(),
    kind: rideKindEnum("kind").default("city").notNull(),
    /** Secret for the driver's page. */
    manageToken: text("manage_token").notNull().unique(),
    driverName: text("driver_name").notNull(),
    /** Digits with country code. Shown to riders once they have booked. */
    driverPhone: text("driver_phone").notNull(),
    driverGender: genderEnum("driver_gender").notNull(),
    /** "Suzuki Cultus, white" */
    car: text("car").notNull(),
    plate: text("plate"),
    seats: integer("seats").notNull(),
    /** Per seat, whole rupees; null = free / to be agreed. */
    fare: integer("fare"),
    riders: rideRidersEnum("riders").default("anyone").notNull(),
    /** Local "HH:MM" leaving the first point. */
    departTime: text("depart_time").notNull(),
    schedule: rideScheduleEnum("schedule").notNull(),
    /** First (or only) day, "YYYY-MM-DD". */
    date: text("date").notNull(),
    /** Weekdays for "weekly": 0 = Sunday ... 6 = Saturday. */
    days: jsonb("days").$type<number[]>().default([]).notNull(),
    /** Last day for daily / weekly rides; null = no end. */
    until: text("until"),
    notes: text("notes"),
    status: rideStatusEnum("status").default("active").notNull(),
    createdAt,
  },
  (t) => [index("rides_status_idx").on(t.status)],
);

/** The route: start, stops in between, end (in order). */
export const ridePoints = pgTable(
  "ride_points",
  {
    id: serial("id").primaryKey(),
    rideId: integer("ride_id").notNull().references(() => rides.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    name: text("name").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** Key from lib/places.ts when picked from the list. */
    placeKey: text("place_key"),
  },
  (t) => [index("ride_points_ride_idx").on(t.rideId)],
);

export const rideBookings = pgTable(
  "ride_bookings",
  {
    id: serial("id").primaryKey(),
    rideId: integer("ride_id").notNull().references(() => rides.id, { onDelete: "cascade" }),
    /** The day of travel, "YYYY-MM-DD". */
    date: text("date").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    gender: genderEnum("gender").notNull(),
    seats: integer("seats").default(1).notNull(),
    pickupIdx: integer("pickup_idx").notNull(),
    dropIdx: integer("drop_idx").notNull(),
    code: text("code").notNull(),
    /** When the rider typed the driver's ride code in the car (the right driver), or null. */
    boardedAt: timestamp("boarded_at", { withTimezone: true }),
    /** Wrong ride codes typed; the check stops after a few. */
    boardTries: integer("board_tries").default(0).notNull(),
    createdAt,
  },
  (t) => [uniqueIndex("ride_bookings_ride_date_phone_uq").on(t.rideId, t.date, t.phone), index("ride_bookings_ride_date_idx").on(t.rideId, t.date)],
);

/** Live positions people chose to share. Rows older than a few minutes are ignored. */
export const livePositions = pgTable(
  "live_positions",
  {
    /** Random id kept by the browser that shares. */
    id: text("id").primaryKey(),
    role: text("role").$type<"driver" | "rider">().notNull(),
    /** Short label: driver's first name, or empty for riders. */
    label: text("label"),
    rideId: integer("ride_id").references(() => rides.id, { onDelete: "cascade" }),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("live_positions_updated_idx").on(t.updatedAt)],
);

/**
 * A rider's rating of a driver after travelling with them. Drivers have no account, so ratings belong to the
 * driver's phone number and follow them across all their rides. One review per rider per driver (updated if
 * they rate again).
 */
export const driverReviews = pgTable(
  "driver_reviews",
  {
    id: serial("id").primaryKey(),
    driverPhone: text("driver_phone").notNull(),
    riderPhone: text("rider_phone").notNull(),
    /** First name only: that's what is shown. */
    riderName: text("rider_name").notNull(),
    rideId: integer("ride_id").references(() => rides.id, { onDelete: "set null" }),
    /** 1 to 5. */
    stars: integer("stars").notNull(),
    comment: text("comment"),
    /** Hidden by a super admin (abusive, fake...). */
    hidden: boolean("hidden").default(false).notNull(),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("driver_reviews_driver_rider_uq").on(t.driverPhone, t.riderPhone), index("driver_reviews_driver_idx").on(t.driverPhone)],
);

/** Messages from riders and drivers to the Hamsafar team: ideas, problems, safety reports. */
export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").$type<"idea" | "problem" | "safety" | "praise">().notNull(),
    role: text("role").$type<"rider" | "driver" | "other">().notNull(),
    message: text("message").notNull(),
    name: text("name"),
    /** Phone or email, if they want a reply. */
    contact: text("contact"),
    /** Page they wrote from, and the ride it was about, if any. */
    page: text("page"),
    rideSlug: text("ride_slug"),
    /** Hash of the sender's IP, only to limit how many messages one sender can post. */
    ipHash: text("ip_hash"),
    status: text("status").$type<"new" | "done">().default("new").notNull(),
    createdAt,
  },
  (t) => [index("feedback_created_idx").on(t.createdAt), index("feedback_ip_idx").on(t.ipHash)],
);

/**
 * WhatsApp phone checks. "send": we message the person a code; they type it in. "message": they send us a
 * WhatsApp containing the code, and the message coming from their number proves it's theirs.
 */
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    /** Random id the browser keeps while it waits. */
    id: text("id").primaryKey(),
    phone: text("phone").notNull(),
    method: text("method").$type<"send" | "message">().notNull(),
    /** sha256 of the code (never stored in clear). */
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt,
  },
  (t) => [index("phone_verifications_phone_idx").on(t.phone)],
);

/* ---------- Identity checks ---------- */

export const idStatusEnum = pgEnum("id_status", ["none", "pending", "approved", "rejected"]);

/**
 * A person on Hamsafar, keyed by their (WhatsApp) phone number. Riders verify with CNIC + selfie (under 18:
 * B-form + a parent's CNIC); drivers also add their driving licence and car registration. Reviewed by a
 * super admin. Photos live (encrypted) in identity_docs.
 */
export const identities = pgTable(
  "identities",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull().unique(),
    idType: text("id_type").$type<"cnic" | "bform">().notNull(),
    /** 13 digits, no dashes. CNIC, or the B-form number for under-18s. */
    idNumber: text("id_number").notNull().unique(),
    fullName: text("full_name").notNull(),
    fatherName: text("father_name"),
    gender: genderEnum("gender").notNull(),
    /** "YYYY-MM-DD" */
    dob: text("dob").notNull(),
    idExpiry: text("id_expiry"),
    guardianName: text("guardian_name"),
    guardianCnic: text("guardian_cnic"),
    guardianRelation: text("guardian_relation"),
    licenseNumber: text("license_number"),
    licenseExpiry: text("license_expiry"),
    /** Who issued the licence: islamabad, punjab, sindh, kp, balochistan, ajk, gb. */
    licenseAuthority: text("license_authority"),
    /** The car's registration number, e.g. "LEA-2207". */
    vehicleReg: text("vehicle_reg"),
    riderStatus: idStatusEnum("rider_status").default("none").notNull(),
    driverStatus: idStatusEnum("driver_status").default("none").notNull(),
    rejectReason: text("reject_reason"),
    /** Automatic checks that need a human look (gender digit, age, duplicate...). */
    warnings: jsonb("warnings").$type<string[]>().default([]).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: integer("reviewed_by").references(() => admins.id, { onDelete: "set null" }),
    createdAt,
  },
  (t) => [index("identities_rider_status_idx").on(t.riderStatus), index("identities_driver_status_idx").on(t.driverStatus)],
);

/** ID photos, encrypted (AES-256-GCM). Only super admins can open them, and every view is logged. */
export const identityDocs = pgTable(
  "identity_docs",
  {
    id: serial("id").primaryKey(),
    identityId: integer("identity_id").notNull().references(() => identities.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"cnic_front" | "cnic_back" | "selfie" | "license" | "bform" | "guardian_front" | "guardian_back">().notNull(),
    mime: text("mime").notNull(),
    /** base64 of iv(12) + ciphertext + tag(16). */
    data: text("data").notNull(),
    createdAt,
  },
  (t) => [index("identity_docs_identity_idx").on(t.identityId)],
);

/** Who opened which ID photo, when. */
export const idAccessLog = pgTable("id_access_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
  identityId: integer("identity_id").references(() => identities.id, { onDelete: "cascade" }),
  docKind: text("doc_kind").notNull(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
});

/** Browsers (e.g. the owner's phone) that get a notification when someone submits their ID. */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt,
});

/** Small key/value settings the app creates itself (e.g. its push notification keys). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Attempt counters for rate limits (sign-in, booking codes, ride creation). Keys never hold raw IP addresses. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type Ride = typeof rides.$inferSelect;
export type RidePoint = typeof ridePoints.$inferSelect;
export type RideBooking = typeof rideBookings.$inferSelect;
export type DriverReview = typeof driverReviews.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type Identity = typeof identities.$inferSelect;
