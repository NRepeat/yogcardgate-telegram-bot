-- CreateTable
CREATE TABLE "BankPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "bankName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankPaymentRequestsMethod_methodId_key" ON "BankPaymentRequestsMethod"("methodId");

-- AddForeignKey
ALTER TABLE "BankPaymentRequestsMethod" ADD CONSTRAINT "BankPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
