-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'COMPLETED', 'ACCEPTED', 'FAILED');

-- CreateEnum
CREATE TYPE "CurrencyEnum" AS ENUM ('AED', 'AZN', 'CNY', 'CZK', 'EUR', 'KZT', 'PLN', 'THB', 'TRY', 'UAH', 'USD');

-- CreateEnum
CREATE TYPE "PaymentMethodEnum" AS ENUM ('CARD', 'IBAN', 'PHONE', 'WISE', 'BANK', 'PAYONEER', 'SKRILL', 'QR', 'KZT_KASPI_BANK', 'KZT_OTHER_BANKS', 'CNY_ALIPAY', 'CNY_WECHAT', 'CNY_CARD', 'CNY_ACCOUNT', 'PAYPAL');

-- CreateEnum
CREATE TYPE "RoleEnum" AS ENUM ('GUEST', 'ADMIN', 'WORKER');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('PUBLIC', 'WORKER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "telegramId" BIGINT NOT NULL,
    "onPause" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workGroupChatId" BIGINT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" "RoleEnum" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendors" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "work" BOOLEAN NOT NULL DEFAULT false,
    "showReceipt" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "token" TEXT,
    "lastReportedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastAllRatesSentAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lastAllRateMessageId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequests" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "userId" TEXT,
    "payedByUserId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "currencyId" TEXT NOT NULL,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "ratesId" TEXT,
    "rate" TEXT DEFAULT '',
    "activeUserId" TEXT,
    "paymentMethodId" TEXT,

    CONSTRAINT "PaymentRequests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "text" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requestId" TEXT NOT NULL,
    "accessType" "AccessType" NOT NULL DEFAULT 'PUBLIC',

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequestMethod" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" "PaymentMethodEnum" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequestMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "card" TEXT NOT NULL,
    "holder" TEXT,
    "bankId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IbanPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "inn" TEXT,
    "comment" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IbanPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WirePaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "bankName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WirePaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "PhonePaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "holderName" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhonePaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkrillEmailPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkrillEmailPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoneerPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoneerPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrPaymentRequestsMethod" (
    "id" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrPaymentRequestsMethod_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Rates" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "minAmount" DOUBLE PRECISION NOT NULL,
    "maxAmount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethodId" TEXT NOT NULL,

    CONSTRAINT "Rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "nameEn" "PaymentMethodEnum" NOT NULL,
    "description" TEXT,
    "descriptionEn" TEXT,
    "icon" TEXT,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" "CurrencyEnum" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "symbol" TEXT,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackList" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "cardNumber" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRequestPhotoMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRequestPhotoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRequestPhotoMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerRequestPhotoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardBank" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankNameEn" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "name" TEXT NOT NULL DEFAULT 'default',
    "onPause" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "_UserToVendors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_UserToVendors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_RoleToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CurrencyToPaymentMethod" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CurrencyToPaymentMethod_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BlackListToCardPaymentRequestsMethod" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BlackListToCardPaymentRequestsMethod_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_workGroupChatId_key" ON "User"("workGroupChatId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_chatId_key" ON "Vendors"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_title_key" ON "Vendors"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_token_key" ON "Vendors"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Vendors_lastAllRateMessageId_key" ON "Vendors"("lastAllRateMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_messageId_key" ON "Message"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "CardPaymentRequestsMethod_methodId_key" ON "CardPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "IbanPaymentRequestsMethod_methodId_key" ON "IbanPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "WirePaymentRequestsMethod_methodId_key" ON "WirePaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "BankPaymentRequestsMethod_methodId_key" ON "BankPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "PhonePaymentRequestsMethod_methodId_key" ON "PhonePaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "SkrillEmailPaymentRequestsMethod_methodId_key" ON "SkrillEmailPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoneerPaymentRequestsMethod_methodId_key" ON "PayoneerPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "QrPaymentRequestsMethod_methodId_key" ON "QrPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "WisePaymentRequestsMethod_methodId_key" ON "WisePaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalPaymentRequestsMethod_methodId_key" ON "PayPalPaymentRequestsMethod"("methodId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_nameEn_key" ON "PaymentMethod"("nameEn");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_name_key" ON "Currency"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BlackList_requestId_key" ON "BlackList"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "CardBank_number_key" ON "CardBank"("number");

-- CreateIndex
CREATE INDEX "_UserToVendors_B_index" ON "_UserToVendors"("B");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- CreateIndex
CREATE INDEX "_CurrencyToPaymentMethod_B_index" ON "_CurrencyToPaymentMethod"("B");

-- CreateIndex
CREATE INDEX "_BlackListToCardPaymentRequestsMethod_B_index" ON "_BlackListToCardPaymentRequestsMethod"("B");

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_payedByUserId_fkey" FOREIGN KEY ("payedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_ratesId_fkey" FOREIGN KEY ("ratesId") REFERENCES "Rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequests" ADD CONSTRAINT "PaymentRequests_activeUserId_fkey" FOREIGN KEY ("activeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestMethod" ADD CONSTRAINT "PaymentRequestMethod_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPaymentRequestsMethod" ADD CONSTRAINT "CardPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPaymentRequestsMethod" ADD CONSTRAINT "CardPaymentRequestsMethod_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "CardBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IbanPaymentRequestsMethod" ADD CONSTRAINT "IbanPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WirePaymentRequestsMethod" ADD CONSTRAINT "WirePaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankPaymentRequestsMethod" ADD CONSTRAINT "BankPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhonePaymentRequestsMethod" ADD CONSTRAINT "PhonePaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkrillEmailPaymentRequestsMethod" ADD CONSTRAINT "SkrillEmailPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoneerPaymentRequestsMethod" ADD CONSTRAINT "PayoneerPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrPaymentRequestsMethod" ADD CONSTRAINT "QrPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WisePaymentRequestsMethod" ADD CONSTRAINT "WisePaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPalPaymentRequestsMethod" ADD CONSTRAINT "PayPalPaymentRequestsMethod_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentRequestMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rates" ADD CONSTRAINT "Rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rates" ADD CONSTRAINT "Rates_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRequestPhotoMessage" ADD CONSTRAINT "AdminRequestPhotoMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRequestPhotoMessage" ADD CONSTRAINT "AdminRequestPhotoMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRequestPhotoMessage" ADD CONSTRAINT "WorkerRequestPhotoMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PaymentRequests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRequestPhotoMessage" ADD CONSTRAINT "WorkerRequestPhotoMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserToVendors" ADD CONSTRAINT "_UserToVendors_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserToVendors" ADD CONSTRAINT "_UserToVendors_B_fkey" FOREIGN KEY ("B") REFERENCES "Vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CurrencyToPaymentMethod" ADD CONSTRAINT "_CurrencyToPaymentMethod_A_fkey" FOREIGN KEY ("A") REFERENCES "Currency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CurrencyToPaymentMethod" ADD CONSTRAINT "_CurrencyToPaymentMethod_B_fkey" FOREIGN KEY ("B") REFERENCES "PaymentMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlackListToCardPaymentRequestsMethod" ADD CONSTRAINT "_BlackListToCardPaymentRequestsMethod_A_fkey" FOREIGN KEY ("A") REFERENCES "BlackList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BlackListToCardPaymentRequestsMethod" ADD CONSTRAINT "_BlackListToCardPaymentRequestsMethod_B_fkey" FOREIGN KEY ("B") REFERENCES "CardPaymentRequestsMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
