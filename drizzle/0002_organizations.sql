CREATE TYPE "public"."admin_role" AS ENUM('super', 'admin');--> statement-breakpoint
CREATE TYPE "public"."gender_rule" AS ENUM('separate', 'none');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('transport', 'institution', 'tour', 'company');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "org_type" NOT NULL,
	"city" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Everything that existed before organisations belongs to the first client (renamed by db-setup).
INSERT INTO "organizations" ("slug", "name", "type") VALUES ('van-service', 'My van service', 'transport');--> statement-breakpoint
CREATE TABLE "riders" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"gender" "gender" NOT NULL,
	"ref_no" text,
	"group_name" text,
	"stop" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "bookings_trip_phone_uq";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "gender" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "role" "admin_role" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "org_id" integer;--> statement-breakpoint
-- Admins from before organisations run the platform.
UPDATE "admins" SET "role" = 'super';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rider_id" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "org_id" integer;--> statement-breakpoint
UPDATE "trips" SET "org_id" = (SELECT min("id") FROM "organizations");--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "end_date" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "gender_rule" "gender_rule" DEFAULT 'separate' NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "max_seats" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "members_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "org_id" integer;--> statement-breakpoint
UPDATE "vehicles" SET "org_id" = (SELECT min("id") FROM "organizations");--> statement-breakpoint
ALTER TABLE "vehicles" ALTER COLUMN "org_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "riders_org_phone_uq" ON "riders" USING btree ("org_id","phone");--> statement-breakpoint
CREATE INDEX "riders_org_idx" ON "riders" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_trip_phone_idx" ON "bookings" USING btree ("trip_id","phone");--> statement-breakpoint
CREATE INDEX "trips_org_idx" ON "trips" USING btree ("org_id");