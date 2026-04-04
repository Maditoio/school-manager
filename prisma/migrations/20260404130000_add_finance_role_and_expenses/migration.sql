ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';

CREATE TYPE "ExpenseCategory" AS ENUM (
  'MAINTENANCE',
  'SALARIES',
  'BURSARIES',
  'SPECIAL_DISCOUNTS',
  'CLEANING',
  'SOFTWARE_LICENSES',
  'TRAINING_PROGRAMS',
  'SPORTS_TRIPS',
  'REFRESHMENTS',
  'KITCHEN',
  'UTILITIES',
  'TRANSPORT',
  'EQUIPMENT',
  'OTHER'
);

CREATE TYPE "ExpenseStatus" AS ENUM ('RECORDED', 'APPROVED', 'VOID');

CREATE TYPE "ExpenseAuditAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED');

CREATE TABLE "expenses" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" "ExpenseCategory" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "expense_date" DATE NOT NULL,
  "payment_method" "PaymentMethod",
  "vendor_name" TEXT,
  "reference_number" TEXT,
  "beneficiary_name" TEXT,
  "student_id" TEXT,
  "status" "ExpenseStatus" NOT NULL DEFAULT 'RECORDED',
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "expense_audit_logs" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "expense_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" "ExpenseAuditAction" NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "expense_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "expenses_school_id_idx" ON "expenses"("school_id");
CREATE INDEX "expenses_category_idx" ON "expenses"("category");
CREATE INDEX "expenses_status_idx" ON "expenses"("status");
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");
CREATE INDEX "expenses_created_by_id_idx" ON "expenses"("created_by_id");
CREATE INDEX "expenses_updated_by_id_idx" ON "expenses"("updated_by_id");
CREATE INDEX "expenses_student_id_idx" ON "expenses"("student_id");
CREATE INDEX "expenses_school_id_expense_date_idx" ON "expenses"("school_id", "expense_date");

CREATE INDEX "expense_audit_logs_school_id_idx" ON "expense_audit_logs"("school_id");
CREATE INDEX "expense_audit_logs_expense_id_idx" ON "expense_audit_logs"("expense_id");
CREATE INDEX "expense_audit_logs_actor_id_idx" ON "expense_audit_logs"("actor_id");
CREATE INDEX "expense_audit_logs_action_idx" ON "expense_audit_logs"("action");
CREATE INDEX "expense_audit_logs_created_at_idx" ON "expense_audit_logs"("created_at");
CREATE INDEX "expense_audit_logs_school_id_created_at_idx" ON "expense_audit_logs"("school_id", "created_at");

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_audit_logs" ADD CONSTRAINT "expense_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;