-- AlterEnum
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'PAYONEER';

-- CreateTable
CREATE TABLE "PayoneerPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoneerPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoneerPaymentRequestsMethod_methodId_key" ON "PayoneerPaymentRequestsMethod"("methodId");

-- AddForeignKey
ALTER TABLE "PayoneerPaymentRequestsMethod" ADD CONSTRAINT "PayoneerPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
