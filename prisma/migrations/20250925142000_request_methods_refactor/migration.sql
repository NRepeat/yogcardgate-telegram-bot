-- Create table for normalized payment request methods
CREATE TABLE "PaymentRequestMethod" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" "PaymentMethodEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentRequestMethod_pkey" PRIMARY KEY ("id")
);

-- Create detail tables for additional payment method payloads
CREATE TABLE "WirePaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "bankName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WirePaymentRequestsMethod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WirePaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WirePaymentRequestsMethod_methodId_key" UNIQUE ("methodId")
);

CREATE TABLE "PhonePaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "holderName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhonePaymentRequestsMethod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PhonePaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhonePaymentRequestsMethod_methodId_key" UNIQUE ("methodId")
);

CREATE TABLE "SkrillEmailPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkrillEmailPaymentRequestsMethod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SkrillEmailPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkrillEmailPaymentRequestsMethod_methodId_key" UNIQUE ("methodId")
);

CREATE TABLE "QrPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrPaymentRequestsMethod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QrPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrPaymentRequestsMethod_methodId_key" UNIQUE ("methodId")
);

-- Add staging columns on existing tables
ALTER TABLE "CardPaymentRequestsMethod" ADD COLUMN "methodId" TEXT;
ALTER TABLE "IbanPaymentRequestsMethod" ADD COLUMN "methodId" TEXT;

-- Backfill PaymentRequestMethod rows for existing card methods
INSERT INTO "PaymentRequestMethod" ("id", "requestId", "method", "createdAt", "updatedAt")
SELECT "id", "requestId", 'CARD', "createdAt", "updatedAt"
FROM "CardPaymentRequestsMethod";

UPDATE "CardPaymentRequestsMethod"
SET "methodId" = "id";

-- Backfill PaymentRequestMethod rows for existing IBAN methods
INSERT INTO "PaymentRequestMethod" ("id", "requestId", "method", "createdAt", "updatedAt")
SELECT "id", "requestId", 'IBAN', "createdAt", "updatedAt"
FROM "IbanPaymentRequestsMethod";

UPDATE "IbanPaymentRequestsMethod"
SET "methodId" = "id";

-- Ensure new columns are populated
ALTER TABLE "CardPaymentRequestsMethod" ALTER COLUMN "methodId" SET NOT NULL;
ALTER TABLE "IbanPaymentRequestsMethod" ALTER COLUMN "methodId" SET NOT NULL;

-- Drop old foreign keys relying on requestId before removing the column
ALTER TABLE "CardPaymentRequestsMethod" DROP CONSTRAINT IF EXISTS "CardPaymentRequestsMethod_requestId_fkey";
ALTER TABLE "IbanPaymentRequestsMethod" DROP CONSTRAINT IF EXISTS "IbanPaymentRequestsMethod_requestId_fkey";

-- Remove legacy requestId columns now that method rows carry the relation
ALTER TABLE "CardPaymentRequestsMethod" DROP COLUMN "requestId";
ALTER TABLE "IbanPaymentRequestsMethod" DROP COLUMN "requestId";

-- Add foreign keys from method detail tables to the new hub table
ALTER TABLE "CardPaymentRequestsMethod"
  ADD CONSTRAINT "CardPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IbanPaymentRequestsMethod"
  ADD CONSTRAINT "IbanPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add unique constraints to guarantee a single detail row per hub method
CREATE UNIQUE INDEX "CardPaymentRequestsMethod_methodId_key" ON "CardPaymentRequestsMethod"("methodId");
CREATE UNIQUE INDEX "IbanPaymentRequestsMethod_methodId_key" ON "IbanPaymentRequestsMethod"("methodId");

-- Link the new hub table back to payment requests
ALTER TABLE "PaymentRequestMethod"
  ADD CONSTRAINT "PaymentRequestMethod_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Helpful index for fast lookup by request
CREATE INDEX "PaymentRequestMethod_requestId_idx" ON "PaymentRequestMethod"("requestId");
