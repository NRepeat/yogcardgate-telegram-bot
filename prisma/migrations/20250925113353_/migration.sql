/*
  Warnings:

  - The values [BANK_ACCOUNT] on the enum `PaymentMethodEnum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethodEnum_new" AS ENUM ('CARD', 'IBAN', 'WIRE', 'PHONE', 'SKRILL_EMAIL', 'QR');
ALTER TABLE "PaymentMethod" ALTER COLUMN "nameEn" TYPE "PaymentMethodEnum_new"
USING (
  CASE
    WHEN "nameEn"::text = 'BANK_ACCOUNT' THEN 'WIRE'
    ELSE "nameEn"::text
  END::"PaymentMethodEnum_new"
);
ALTER TYPE "PaymentMethodEnum" RENAME TO "PaymentMethodEnum_old";
ALTER TYPE "PaymentMethodEnum_new" RENAME TO "PaymentMethodEnum";
DROP TYPE "PaymentMethodEnum_old";
COMMIT;
