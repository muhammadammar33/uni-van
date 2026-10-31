ALTER TABLE "users" ADD COLUMN "block_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_by" integer;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_admins_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;