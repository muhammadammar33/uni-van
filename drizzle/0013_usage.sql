CREATE TABLE "usage_daily" (
	"day" text NOT NULL,
	"metric" text NOT NULL,
	"key" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_daily_day_metric_key_pk" PRIMARY KEY("day","metric","key")
);
--> statement-breakpoint
CREATE TABLE "visitor_days" (
	"day" text NOT NULL,
	"hash" text NOT NULL,
	CONSTRAINT "visitor_days_day_hash_pk" PRIMARY KEY("day","hash")
);
