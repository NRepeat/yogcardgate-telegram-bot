/*
  Warnings:

  - A unique constraint covering the columns `[workGroupChatId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "workGroupChatId" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "User_workGroupChatId_key" ON "User"("workGroupChatId");
