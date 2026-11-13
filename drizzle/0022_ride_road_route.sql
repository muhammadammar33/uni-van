ALTER TABLE "rides" ADD COLUMN "km_per_litre" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "leg_km" jsonb;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "route_line" text;