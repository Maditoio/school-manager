-- AlterTable
ALTER TABLE "school_settings"
ADD COLUMN "minimum_pass_rate_per_subject" DOUBLE PRECISION NOT NULL DEFAULT 50;
