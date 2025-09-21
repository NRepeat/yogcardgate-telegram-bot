/*
  Warnings:

  - You are about to drop the column `paymentMethodId` on the `Currency` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Currency" DROP CONSTRAINT "Currency_paymentMethodId_fkey";

-- AlterTable
ALTER TABLE "Currency" DROP COLUMN "paymentMethodId";

-- CreateTable
CREATE TABLE "_CurrencyToPaymentMethod" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CurrencyToPaymentMethod_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CurrencyToPaymentMethod_B_index" ON "_CurrencyToPaymentMethod"("B");

-- AddForeignKey
ALTER TABLE "_CurrencyToPaymentMethod" ADD CONSTRAINT "_CurrencyToPaymentMethod_A_fkey" FOREIGN KEY ("A") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CurrencyToPaymentMethod" ADD CONSTRAINT "_CurrencyToPaymentMethod_B_fkey" FOREIGN KEY ("B") REFERENCES "PaymentMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
