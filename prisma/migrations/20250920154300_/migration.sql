-- AlterTable
ALTER TABLE "Currency" ADD COLUMN     "paymentMethodId" TEXT;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
