UPDATE "classrooms"
SET "default_group_id" = NULL
WHERE "default_group_id" IS NOT NULL
  AND (
    char_length("default_group_id") > 50
    OR NOT EXISTS (
      SELECT 1
      FROM "whitelist_groups"
      WHERE "whitelist_groups"."id" = "classrooms"."default_group_id"
    )
  );--> statement-breakpoint
UPDATE "classrooms"
SET "active_group_id" = NULL
WHERE "active_group_id" IS NOT NULL
  AND (
    char_length("active_group_id") > 50
    OR NOT EXISTS (
      SELECT 1
      FROM "whitelist_groups"
      WHERE "whitelist_groups"."id" = "classrooms"."active_group_id"
    )
  );--> statement-breakpoint
DELETE FROM "requests"
WHERE char_length("group_id") > 50
   OR NOT EXISTS (
    SELECT 1
    FROM "whitelist_groups"
    WHERE "whitelist_groups"."id" = "requests"."group_id"
  );--> statement-breakpoint
DELETE FROM "schedules"
WHERE char_length("group_id") > 50
   OR NOT EXISTS (
    SELECT 1
    FROM "whitelist_groups"
    WHERE "whitelist_groups"."id" = "schedules"."group_id"
  );--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "default_group_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "active_group_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "requests" ALTER COLUMN "group_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "schedules" ALTER COLUMN "group_id" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_default_group_id_whitelist_groups_id_fk" FOREIGN KEY ("default_group_id") REFERENCES "public"."whitelist_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_active_group_id_whitelist_groups_id_fk" FOREIGN KEY ("active_group_id") REFERENCES "public"."whitelist_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_group_id_whitelist_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."whitelist_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_group_id_whitelist_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."whitelist_groups"("id") ON DELETE cascade ON UPDATE no action;
