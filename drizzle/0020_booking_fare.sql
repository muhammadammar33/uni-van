ALTER TABLE "ride_bookings" ADD COLUMN "fare" integer;--> statement-breakpoint
UPDATE "ride_bookings" AS b SET "fare" = r."fare" FROM "rides" AS r WHERE r."id" = b."ride_id" AND b."fare" IS NULL;
