CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ride_bookings" ADD COLUMN "rider_read_id" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ride_bookings" ADD COLUMN "driver_read_id" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ride_bookings" ADD COLUMN "chat_closed_by" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_booking_id_ride_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."ride_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_booking_idx" ON "chat_messages" USING btree ("booking_id","id");--> statement-breakpoint
CREATE INDEX "chat_messages_created_idx" ON "chat_messages" USING btree ("created_at");