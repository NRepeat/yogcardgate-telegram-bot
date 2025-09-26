/*
  Warnings:

  - The values [SKRILL_EMAIL] on the enum `PaymentMethodEnum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethodEnum_new" AS ENUM ('CARD', 'IBAN', 'WIRE', 'PHONE', 'WIZE', 'BANK', 'PAYONEER', 'SKRILL', 'QR');
ALTER TABLE "PaymentRequestMethod" ALTER COLUMN "method" TYPE "PaymentMethodEnum_new" USING ("method"::text::"PaymentMethodEnum_new");
ALTER TABLE "PaymentMethod" ALTER COLUMN "nameEn" TYPE "PaymentMethodEnum_new" USING ("nameEn"::text::"PaymentMethodEnum_new");
ALTER TYPE "PaymentMethodEnum" RENAME TO "PaymentMethodEnum_old";
ALTER TYPE "PaymentMethodEnum_new" RENAME TO "PaymentMethodEnum";
DROP TYPE "PaymentMethodEnum_old";
COMMIT;
