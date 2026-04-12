-- CreateEnum
CREATE TYPE "SchoolOnboardingStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateTable
CREATE TABLE "school_billing" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "onboarding_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onboarding_status" "SchoolOnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "annual_price_per_student" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "licensed_student_count" INTEGER NOT NULL DEFAULT 0,
    "billing_year" INTEGER NOT NULL DEFAULT 0,
    "license_start_date" DATE,
    "license_end_date" DATE,
    "enabled_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_billing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_billing_school_id_key" ON "school_billing"("school_id");

-- CreateIndex
CREATE INDEX "school_billing_billing_year_idx" ON "school_billing"("billing_year");

-- AddForeignKey
ALTER TABLE "school_billing" ADD CONSTRAINT "school_billing_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
