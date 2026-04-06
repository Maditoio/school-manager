-- AlterTable: add currency column to school_settings
ALTER TABLE "school_settings" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'ZAR';
