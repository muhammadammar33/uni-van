CREATE TABLE "app_sign_ins" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"challenge" text NOT NULL,
	"next" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_sign_ins" ADD CONSTRAINT "app_sign_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;