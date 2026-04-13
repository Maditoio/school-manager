CREATE TYPE "StudentLicenseSource" AS ENUM ('BULK', 'EXTRA_PAYMENT');

CREATE TABLE "student_licenses" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "license_year" INTEGER NOT NULL,
    "source" "StudentLicenseSource" NOT NULL DEFAULT 'BULK',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_licenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_licenses_student_id_license_year_key" ON "student_licenses"("student_id", "license_year");
CREATE INDEX "student_licenses_school_id_idx" ON "student_licenses"("school_id");
CREATE INDEX "student_licenses_student_id_idx" ON "student_licenses"("student_id");
CREATE INDEX "student_licenses_license_year_idx" ON "student_licenses"("license_year");
CREATE INDEX "student_licenses_school_id_license_year_idx" ON "student_licenses"("school_id", "license_year");

ALTER TABLE "student_licenses"
ADD CONSTRAINT "student_licenses_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_licenses"
ADD CONSTRAINT "student_licenses_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;