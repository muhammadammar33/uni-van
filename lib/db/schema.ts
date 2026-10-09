import { boolean, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { Layout } from "../layout";

export const directionEnum = pgEnum("trip_direction", ["to_uni", "to_home"]);
export const tripStatusEnum = pgEnum("trip_status", ["open", "closed"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt,
});

/** Saved seating plans (a Hiace, a Coaster...) that trips copy their layout from. */
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  layout: jsonb("layout").$type<Layout>().notNull(),
  createdAt,
});

export const trips = pgTable(
  "trips",
  {
    id: serial("id").primaryKey(),
    /** Random id used in the public link: /t/<slug> */
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    direction: directionEnum("direction").notNull(),
    /** Local date, "YYYY-MM-DD" */
    date: text("date").notNull(),
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
    createdAt,
  },
  (t) => [index("trips_date_idx").on(t.date)],
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
    gender: genderEnum("gender").notNull(),
    /** Short code the passenger uses to look up or cancel their booking. */
    code: text("code").notNull(),
    /** Fare for this seat when it was booked, so later fare changes don't alter what the passenger was told. */
    fare: integer("fare"),
    boarded: boolean("boarded").default(false).notNull(),
    paid: boolean("paid").default(false).notNull(),
    createdAt,
  },
  (t) => [uniqueIndex("bookings_trip_seat_uq").on(t.tripId, t.seatId), uniqueIndex("bookings_trip_phone_uq").on(t.tripId, t.phone)],
);

export type Trip = typeof trips.$inferSelect;
export type Stop = typeof stops.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
