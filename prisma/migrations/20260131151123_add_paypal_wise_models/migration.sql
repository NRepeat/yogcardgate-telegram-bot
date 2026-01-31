-- AlterEnum
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'PAYPAL';

-- CreateTable
CREATE TABLE "WisePaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cardNumber" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WisePaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPalPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPalPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WisePaymentRequestsMethod_methodId_key" ON "WisePaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalPaymentRequestsMethod_methodId_key" ON "PayPalPaymentRequestsMethod"("methodId");

-- AddForeignKey
ALTER TABLE "WisePaymentRequestsMethod" ADD CONSTRAINT "WisePaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPalPaymentRequestsMethod" ADD CONSTRAINT "PayPalPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
