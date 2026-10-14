CREATE TABLE "driver_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_phone" text NOT NULL,
	"rider_phone" text NOT NULL,
	"rider_name" text NOT NULL,
	"ride_id" integer,
	"stars" integer NOT NULL,
	"comment" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"role" text NOT NULL,
	"message" text NOT NULL,
	"name" text,
	"contact" text,
	"page" text,
	"ride_slug" text,
	"ip_hash" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_reviews" ADD CONSTRAINT "driver_reviews_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "driver_reviews_driver_rider_uq" ON "driver_reviews" USING btree ("driver_phone","rider_phone");--> statement-breakpoint
CREATE INDEX "driver_reviews_driver_idx" ON "driver_reviews" USING btree ("driver_phone");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_ip_idx" ON "feedback" USING btree ("ip_hash");