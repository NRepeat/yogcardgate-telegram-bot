-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethodEnum" ADD VALUE 'WISE';
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'BANK';

-- DropIndex
DROP INDEX "PaymentRequestMethod_requestId_idx";

-- AlterTable
ALTER TABLE "PaymentRequestMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PhonePaymentRequestsMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QrPaymentRequestsMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SkrillEmailPaymentRequestsMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WirePaymentRequestsMethod" ALTER COLUMN "updatedAt" DROP DEFAULT;
