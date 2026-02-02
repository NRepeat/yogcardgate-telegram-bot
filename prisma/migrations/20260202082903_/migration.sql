/*
  Warnings:

  - The values [WISE] on the enum `PaymentMethodEnum` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethodEnum_new" AS ENUM ('CARD', 'IBAN', 'PHONE', 'WISE', 'BANK', 'PAYONEER', 'SKRILL', 'QR', 'KZT_KASPI_BANK', 'KZT_OTHER_BANKS', 'CNY_ALIPAY', 'CNY_WECHAT', 'CNY_CARD', 'CNY_ACCOUNT', 'PAYPAL');
ALTER TABLE "PaymentRequestMethod" ALTER COLUMN "method" TYPE "PaymentMethodEnum_new" USING ("method"::text::"PaymentMethodEnum_new");
ALTER TABLE "PaymentMethod" ALTER COLUMN "nameEn" TYPE "PaymentMethodEnum_new" USING ("nameEn"::text::"PaymentMethodEnum_new");
ALTER TYPE "PaymentMethodEnum" RENAME TO "PaymentMethodEnum_old";
ALTER TYPE "PaymentMethodEnum_new" RENAME TO "PaymentMethodEnum";
DROP TYPE "PaymentMethodEnum_old";
COMMIT;
