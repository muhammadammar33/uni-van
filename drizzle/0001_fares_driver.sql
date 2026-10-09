ALTER TABLE "bookings" ADD COLUMN "fare" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "boarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "fare" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "driver_token" text;--> statement-breakpoint
UPDATE "trips" SET "driver_token" = md5(random()::text || clock_timestamp()::text || "id"::text) WHERE "driver_token" IS NULL;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "driver_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_token_unique" UNIQUE("driver_token");