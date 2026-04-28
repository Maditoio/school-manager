CREATE TABLE IF NOT EXISTS "student_course_profiles" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "term_name" TEXT NOT NULL,
    "term_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overall_pass_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subject_averages" JSON NOT NULL,
    "strong_subjects" JSON NOT NULL,
    "weak_subjects" JSON NOT NULL,
    "recommendation_tags" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_course_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_course_profiles_student_id_term_id_key" UNIQUE ("student_id", "term_id")
);

CREATE INDEX IF NOT EXISTS "student_course_profiles_school_id_idx" ON "student_course_profiles"("school_id");
CREATE INDEX IF NOT EXISTS "student_course_profiles_student_id_idx" ON "student_course_profiles"("student_id");
CREATE INDEX IF NOT EXISTS "student_course_profiles_term_id_idx" ON "student_course_profiles"("term_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_course_profiles_school_id_fkey'
  ) THEN
    ALTER TABLE "student_course_profiles"
      ADD CONSTRAINT "student_course_profiles_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_course_profiles_student_id_fkey'
  ) THEN
    ALTER TABLE "student_course_profiles"
      ADD CONSTRAINT "student_course_profiles_student_id_fkey"
      FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_course_profiles_term_id_fkey'
  ) THEN
    ALTER TABLE "student_course_profiles"
      ADD CONSTRAINT "student_course_profiles_term_id_fkey"
      FOREIGN KEY ("term_id") REFERENCES "terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
