-- Adds User.telegramId so the Telegram bot can identify an owner/admin
-- (linked via a one-time code, see modules/owner-link) separately from
-- a customer chat (which links via Customer.telegramId, added earlier).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

