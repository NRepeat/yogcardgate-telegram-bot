-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CurrencyEnum" ADD VALUE 'AED';
ALTER TYPE "CurrencyEnum" ADD VALUE 'AZN';
ALTER TYPE "CurrencyEnum" ADD VALUE 'CNY';
ALTER TYPE "CurrencyEnum" ADD VALUE 'CZK';
ALTER TYPE "CurrencyEnum" ADD VALUE 'EUR';
ALTER TYPE "CurrencyEnum" ADD VALUE 'KZT';
ALTER TYPE "CurrencyEnum" ADD VALUE 'PLN';
ALTER TYPE "CurrencyEnum" ADD VALUE 'THB';
ALTER TYPE "CurrencyEnum" ADD VALUE 'TRY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentMethodEnum" ADD VALUE 'BANK_ACCOUNT';
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'PHONE';
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'SKRILL_EMAIL';
ALTER TYPE "PaymentMethodEnum" ADD VALUE 'QR';
