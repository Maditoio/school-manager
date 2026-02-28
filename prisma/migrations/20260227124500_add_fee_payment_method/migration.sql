-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'M_PESA', 'ORANGE_MONEY', 'OTHER');

-- AlterTable
ALTER TABLE "fee_payments"
ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "fee_payments_payment_method_idx" ON "fee_payments"("payment_method");
