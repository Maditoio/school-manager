-- Remove grace period setting (no longer used)
ALTER TABLE "school_settings" DROP COLUMN IF EXISTS "fee_grace_period_days";

-- Create student license payments table
CREATE TABLE "student_license_payments" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "license_year" INTEGER NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'OTHER',
    "reference_number" TEXT,
    "notes" TEXT,
    "received_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_license_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_license_payments_school_id_idx" ON "student_license_payments"("school_id");
CREATE INDEX "student_license_payments_student_id_idx" ON "student_license_payments"("student_id");
CREATE INDEX "student_license_payments_license_year_idx" ON "student_license_payments"("license_year");
CREATE INDEX "student_license_payments_school_id_student_id_license_year_idx" ON "student_license_payments"("school_id", "student_id", "license_year");

ALTER TABLE "student_license_payments" ADD CONSTRAINT "student_license_payments_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_license_payments" ADD CONSTRAINT "student_license_payments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_license_payments" ADD CONSTRAINT "student_license_payments_received_by_fkey"
  FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
