-- DropIndex
DROP INDEX IF EXISTS "Message_messageId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Message_chatId_messageId_key" ON "Message"("chatId", "messageId");
