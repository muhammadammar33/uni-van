CREATE TABLE "route_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" "ride_kind" DEFAULT 'city' NOT NULL,
	"from_name" text NOT NULL,
	"from_lat" double precision NOT NULL,
	"from_lng" double precision NOT NULL,
	"to_name" text NOT NULL,
	"to_lat" double precision NOT NULL,
	"to_lng" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route_alerts" ADD CONSTRAINT "route_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "route_alerts_user_idx" ON "route_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "route_alerts_kind_idx" ON "route_alerts" USING btree ("kind","expires_at");