-- CreateEnum
CREATE TYPE "FeeScheduleStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED');

-- AlterTable: add columns to fee_schedules
-- Existing rows are treated as already-approved flat-rate schedules
ALTER TABLE "fee_schedules"
  ADD COLUMN "class_id" TEXT,
  ADD COLUMN "status" "FeeScheduleStatus" NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN "approved_by" TEXT,
  ADD COLUMN "approved_at" TIMESTAMPTZ;

-- AddForeignKey for class_id
ALTER TABLE "fee_schedules"
  ADD CONSTRAINT "fee_schedules_class_id_fkey"
  FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey for approved_by
ALTER TABLE "fee_schedules"
  ADD CONSTRAINT "fee_schedules_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropIndex: old unique constraint
DROP INDEX IF EXISTS "fee_schedules_school_id_period_type_year_month_semester_key";

-- CreateIndex: new unique constraint including class_id, NULLs treated as equal
ALTER TABLE "fee_schedules"
  ADD CONSTRAINT "fee_schedules_school_id_class_id_period_type_year_month_semester_key"
  UNIQUE NULLS NOT DISTINCT ("school_id", "class_id", "period_type", "year", "month", "semester");

-- CreateIndex: status index
CREATE INDEX "fee_schedules_status_idx" ON "fee_schedules"("status");
