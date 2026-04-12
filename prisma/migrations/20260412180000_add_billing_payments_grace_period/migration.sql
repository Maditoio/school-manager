-- Add fee_grace_period_days to school_settings
ALTER TABLE "school_settings" ADD COLUMN "fee_grace_period_days" INTEGER NOT NULL DEFAULT 0;

-- Create enum for billing payment types
CREATE TYPE "BillingPaymentType" AS ENUM ('ONBOARDING', 'ANNUAL', 'ADJUSTMENT');

-- Create school_billing_payments table
CREATE TABLE "school_billing_payments" (
    "id" TEXT NOT NULL,
    "billing_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payment_type" "BillingPaymentType" NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" TEXT,
    "reference_number" TEXT,
    "notes" TEXT,
    "recorded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_billing_payments_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "school_billing_payments_billing_id_idx" ON "school_billing_payments"("billing_id");
CREATE INDEX "school_billing_payments_payment_date_idx" ON "school_billing_payments"("payment_date");

-- Add foreign key to school_billing
ALTER TABLE "school_billing_payments" ADD CONSTRAINT "school_billing_payments_billing_id_fkey"
  FOREIGN KEY ("billing_id") REFERENCES "school_billing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key to users (nullable)
ALTER TABLE "school_billing_payments" ADD CONSTRAINT "school_billing_payments_recorded_by_id_fkey"
  FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
