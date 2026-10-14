CREATE TYPE "public"."id_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ride_kind" AS ENUM('city', 'intercity');--> statement-breakpoint
ALTER TYPE "public"."ride_status" ADD VALUE 'pending';--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "id_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"identity_id" integer,
	"doc_kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"id_type" text NOT NULL,
	"id_number" text NOT NULL,
	"full_name" text NOT NULL,
	"father_name" text,
	"gender" "gender" NOT NULL,
	"dob" text NOT NULL,
	"id_expiry" text,
	"guardian_name" text,
	"guardian_cnic" text,
	"guardian_relation" text,
	"license_number" text,
	"license_expiry" text,
	"license_authority" text,
	"vehicle_reg" text,
	"rider_status" "id_status" DEFAULT 'none' NOT NULL,
	"driver_status" "id_status" DEFAULT 'none' NOT NULL,
	"reject_reason" text,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identities_phone_unique" UNIQUE("phone"),
	CONSTRAINT "identities_id_number_unique" UNIQUE("id_number")
);
--> statement-breakpoint
CREATE TABLE "identity_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity_id" integer NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "kind" "ride_kind" DEFAULT 'city' NOT NULL;--> statement-breakpoint
ALTER TABLE "id_access_log" ADD CONSTRAINT "id_access_log_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "id_access_log" ADD CONSTRAINT "id_access_log_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_docs" ADD CONSTRAINT "identity_docs_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "public"."identities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identities_rider_status_idx" ON "identities" USING btree ("rider_status");--> statement-breakpoint
CREATE INDEX "identities_driver_status_idx" ON "identities" USING btree ("driver_status");--> statement-breakpoint
CREATE INDEX "identity_docs_identity_idx" ON "identity_docs" USING btree ("identity_id");