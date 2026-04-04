-- CreateEnum
CREATE TYPE "FundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "fund_requests" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "FundRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "review_note" TEXT,
    "expense_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fund_requests_expense_id_key" ON "fund_requests"("expense_id");

-- CreateIndex
CREATE INDEX "fund_requests_school_id_idx" ON "fund_requests"("school_id");

-- CreateIndex
CREATE INDEX "fund_requests_requested_by_id_idx" ON "fund_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "fund_requests_status_idx" ON "fund_requests"("status");

-- CreateIndex
CREATE INDEX "fund_requests_school_id_status_idx" ON "fund_requests"("school_id", "status");

-- CreateIndex
CREATE INDEX "fund_requests_created_at_idx" ON "fund_requests"("created_at");

-- AddForeignKey
ALTER TABLE "fund_requests" ADD CONSTRAINT "fund_requests_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_requests" ADD CONSTRAINT "fund_requests_requested_by_id_fkey"
    FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_requests" ADD CONSTRAINT "fund_requests_reviewed_by_id_fkey"
    FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_requests" ADD CONSTRAINT "fund_requests_expense_id_fkey"
    FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
