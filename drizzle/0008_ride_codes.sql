ALTER TABLE "ride_bookings" ADD COLUMN "boarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ride_bookings" ADD COLUMN "board_tries" integer DEFAULT 0 NOT NULL;