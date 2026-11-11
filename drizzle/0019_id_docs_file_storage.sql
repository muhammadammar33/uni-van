ALTER TABLE "identity_docs" ALTER COLUMN "data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "identities" ADD COLUMN "photos_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_docs" ADD COLUMN "blob_url" text;