ALTER TABLE "announcements"
ADD COLUMN "start_date" TIMESTAMP(3),
ADD COLUMN "end_date" TIMESTAMP(3),
ADD COLUMN "image_url" TEXT;

UPDATE "announcements"
SET "start_date" = "created_at"
WHERE "start_date" IS NULL;

ALTER TABLE "announcements"
ALTER COLUMN "start_date" SET NOT NULL;

CREATE INDEX "announcements_start_date_idx" ON "announcements"("start_date");
CREATE INDEX "announcements_end_date_idx" ON "announcements"("end_date");