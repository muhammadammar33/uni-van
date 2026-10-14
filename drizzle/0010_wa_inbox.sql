CREATE TABLE "wa_media" (
	"message_id" integer PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wa_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"wa_id" text NOT NULL,
	"name" text,
	"direction" text NOT NULL,
	"type" text NOT NULL,
	"body" text,
	"wa_message_id" text,
	"status" text,
	"error" text,
	"media_id" text,
	"mime" text,
	"file_name" text,
	"admin_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wa_messages_wa_message_id_unique" UNIQUE("wa_message_id")
);
--> statement-breakpoint
ALTER TABLE "wa_media" ADD CONSTRAINT "wa_media_message_id_wa_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."wa_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wa_messages_wa_id_idx" ON "wa_messages" USING btree ("wa_id","created_at");