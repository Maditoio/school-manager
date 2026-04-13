DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'TeacherSalaryStatus'
  ) THEN
    CREATE TYPE "TeacherSalaryStatus" AS ENUM ('PENDING', 'PAID');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "teacher_salary_configs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "base_amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_salary_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teacher_salary_configs_teacher_id_key" UNIQUE ("teacher_id")
);

CREATE TABLE IF NOT EXISTS "teacher_salaries" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "payment_date" DATE,
    "status" "TeacherSalaryStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "recorded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_salaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teacher_salaries_teacher_id_month_year_key" UNIQUE ("teacher_id", "month", "year")
);

CREATE INDEX IF NOT EXISTS "teacher_salary_configs_school_id_idx" ON "teacher_salary_configs"("school_id");
CREATE INDEX IF NOT EXISTS "teacher_salaries_school_id_idx" ON "teacher_salaries"("school_id");
CREATE INDEX IF NOT EXISTS "teacher_salaries_teacher_id_idx" ON "teacher_salaries"("teacher_id");
CREATE INDEX IF NOT EXISTS "teacher_salaries_status_idx" ON "teacher_salaries"("status");
CREATE INDEX IF NOT EXISTS "teacher_salaries_school_id_year_month_idx" ON "teacher_salaries"("school_id", "year", "month");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_salary_configs_school_id_fkey'
  ) THEN
    ALTER TABLE "teacher_salary_configs"
      ADD CONSTRAINT "teacher_salary_configs_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_salary_configs_teacher_id_fkey'
  ) THEN
    ALTER TABLE "teacher_salary_configs"
      ADD CONSTRAINT "teacher_salary_configs_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_salary_configs_updated_by_fkey'
  ) THEN
    ALTER TABLE "teacher_salary_configs"
      ADD CONSTRAINT "teacher_salary_configs_updated_by_fkey"
      FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_salaries_school_id_fkey'
  ) THEN
    ALTER TABLE "teacher_salaries"
      ADD CONSTRAINT "teacher_salaries_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_salaries_teacher_id_fkey'
  ) THEN
    ALTER TABLE "teacher_salaries"
      ADD CONSTRAINT "teacher_salaries_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teacher_salaries_recorded_by_fkey'
  ) THEN
    ALTER TABLE "teacher_salaries"
      ADD CONSTRAINT "teacher_salaries_recorded_by_fkey"
      FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "teacher_salaries"
ADD COLUMN IF NOT EXISTS "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
