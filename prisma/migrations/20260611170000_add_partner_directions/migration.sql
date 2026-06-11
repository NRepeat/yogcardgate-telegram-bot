-- AlterEnum: currencies from partner list (payout module coverage)
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'GBP';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'SEK';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'MDL';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'AMD';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'KGS';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'BGN';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'HUF';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'GEL';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'TJS';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'INR';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'IDR';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'RON';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'BRL';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'ARS';
ALTER TYPE "CurrencyEnum" ADD VALUE IF NOT EXISTS 'VND';

-- AlterEnum: new payment methods
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'REVOLUT';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'AMD_IDRAM';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'KGS_ELCART';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'INR_UPI';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'INR_PAYTM';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'BRL_PIX';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'BRL_ATM_QR';
ALTER TYPE "PaymentMethodEnum" ADD VALUE IF NOT EXISTS 'ARS_MERCADO_PAGO';

-- CreateTable: generic requisites storage for form-driven directions
CREATE TABLE "GenericPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenericPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenericPaymentRequestsMethod_methodId_key" ON "GenericPaymentRequestsMethod"("methodId");

ALTER TABLE "GenericPaymentRequestsMethod" ADD CONSTRAINT "GenericPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
