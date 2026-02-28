-- Add class capacity for dashboard capacity alerts
ALTER TABLE "classes"
ADD COLUMN "capacity" INTEGER;

-- Teacher contract tracking enums and table
CREATE TYPE "TeacherContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TERMINATED');

CREATE TABLE "teacher_contracts" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "teacher_id" TEXT NOT NULL,
  "title" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "TeacherContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teacher_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teacher_contracts_teacher_id_start_date_end_date_key"
ON "teacher_contracts"("teacher_id", "start_date", "end_date");

CREATE INDEX "teacher_contracts_school_id_idx" ON "teacher_contracts"("school_id");
CREATE INDEX "teacher_contracts_teacher_id_idx" ON "teacher_contracts"("teacher_id");
CREATE INDEX "teacher_contracts_status_idx" ON "teacher_contracts"("status");
CREATE INDEX "teacher_contracts_end_date_idx" ON "teacher_contracts"("end_date");
CREATE INDEX "teacher_contracts_school_id_status_end_date_idx" ON "teacher_contracts"("school_id", "status", "end_date");

ALTER TABLE "teacher_contracts"
ADD CONSTRAINT "teacher_contracts_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_contracts"
ADD CONSTRAINT "teacher_contracts_teacher_id_fkey"
FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Parent complaint tracking enums and table
CREATE TYPE "ParentComplaintStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

CREATE TABLE "parent_complaints" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "parent_id" TEXT,
  "student_id" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "ParentComplaintStatus" NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "parent_complaints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parent_complaints_school_id_idx" ON "parent_complaints"("school_id");
CREATE INDEX "parent_complaints_parent_id_idx" ON "parent_complaints"("parent_id");
CREATE INDEX "parent_complaints_student_id_idx" ON "parent_complaints"("student_id");
CREATE INDEX "parent_complaints_status_idx" ON "parent_complaints"("status");
CREATE INDEX "parent_complaints_created_at_idx" ON "parent_complaints"("created_at");
CREATE INDEX "parent_complaints_school_id_status_created_at_idx" ON "parent_complaints"("school_id", "status", "created_at");

ALTER TABLE "parent_complaints"
ADD CONSTRAINT "parent_complaints_school_id_fkey"
FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parent_complaints"
ADD CONSTRAINT "parent_complaints_parent_id_fkey"
FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "parent_complaints"
ADD CONSTRAINT "parent_complaints_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
