-- AlterTable: add suspension fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT;
