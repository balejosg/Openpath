-- Add machine download tokens and Google OAuth support

ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "download_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN IF NOT EXISTS "download_token_last_rotated_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "machines_download_token_hash_unique" ON "machines" ("download_token_hash");--> statement-breakpoint

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_id" varchar(255);--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
