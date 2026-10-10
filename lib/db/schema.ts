import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
