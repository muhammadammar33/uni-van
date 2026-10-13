CREATE TYPE "public"."ride_riders" AS ENUM('anyone', 'female', 'male');--> statement-breakpoint
CREATE TYPE "public"."ride_schedule" AS ENUM('once', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TABLE "live_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"label" text,
	"ride_id" integer,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ride_id" integer NOT NULL,
	"date" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"gender" "gender" NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"pickup_idx" integer NOT NULL,
	"drop_idx" integer NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ride_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"ride_id" integer NOT NULL,
	"idx" integer NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"place_key" text
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"manage_token" text NOT NULL,
	"driver_name" text NOT NULL,
	"driver_phone" text NOT NULL,
	"driver_gender" "gender" NOT NULL,
	"car" text NOT NULL,
	"plate" text,
	"seats" integer NOT NULL,
	"fare" integer,
	"riders" "ride_riders" DEFAULT 'anyone' NOT NULL,
	"depart_time" text NOT NULL,
	"schedule" "ride_schedule" NOT NULL,
	"date" text NOT NULL,
	"days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"until" text,
	"notes" text,
	"status" "ride_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rides_slug_unique" UNIQUE("slug"),
	CONSTRAINT "rides_manage_token_unique" UNIQUE("manage_token")
);
--> statement-breakpoint
ALTER TABLE "live_positions" ADD CONSTRAINT "live_positions_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_bookings" ADD CONSTRAINT "ride_bookings_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ride_points" ADD CONSTRAINT "ride_points_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_positions_updated_idx" ON "live_positions" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ride_bookings_ride_date_phone_uq" ON "ride_bookings" USING btree ("ride_id","date","phone");--> statement-breakpoint
CREATE INDEX "ride_bookings_ride_date_idx" ON "ride_bookings" USING btree ("ride_id","date");--> statement-breakpoint
CREATE INDEX "ride_points_ride_idx" ON "ride_points" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "rides_status_idx" ON "rides" USING btree ("status");