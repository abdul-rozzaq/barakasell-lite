-- Loyalty program: Customer gets a card code + points cache, Sale tracks
-- points earned/redeemed, Settings holds the earn/redeem rules, and
-- LoyaltyEntry is the append-only ledger (same pattern as CustomerDebtEntry).

-- CreateEnum
CREATE TYPE "LoyaltyEntryType" AS ENUM ('EARN', 'REDEEM', 'ADJUSTMENT', 'RETURN_REVERSAL');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "cardCode" TEXT,
ADD COLUMN     "pointsBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "telegramId" BIGINT,
ADD COLUMN     "telegramUsername" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "loyaltyDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "loyaltyEarnPerSum" DECIMAL(14,2) NOT NULL DEFAULT 1000,
ADD COLUMN     "loyaltyEarnPoints" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyMaxRedeemPercent" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "loyaltyMinRedeemPoints" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "loyaltyPointValue" DECIMAL(14,2) NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "LoyaltyEntry" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "LoyaltyEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "userId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "LoyaltyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoyaltyEntry_customerId_seq_idx" ON "LoyaltyEntry"("customerId", "seq");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_refType_refId_idx" ON "LoyaltyEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_occurredAt_idx" ON "LoyaltyEntry"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_cardCode_key" ON "Customer"("cardCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_telegramId_key" ON "Customer"("telegramId");

-- AddForeignKey
ALTER TABLE "LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

