-- Waitlist (ProductRequest) + notification outbox (NotificationOutbox)
-- for the Telegram bot: a customer asks for an out-of-stock product,
-- ReceiptsService.post() resolves matching OPEN requests and queues a
-- durable outbox row the bot polls to deliver.

-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('OPEN', 'NOTIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProductRequestSource" AS ENUM ('BOT', 'POS', 'ADMIN');

-- CreateEnum
CREATE TYPE "OutboxTargetType" AS ENUM ('CUSTOMER', 'OWNER');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT,
    "rawText" TEXT,
    "phone" TEXT,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'OPEN',
    "source" "ProductRequestSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "targetType" "OutboxTargetType" NOT NULL,
    "targetTelegramId" BIGINT,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductRequest_status_productId_idx" ON "ProductRequest"("status", "productId");

-- CreateIndex
CREATE INDEX "ProductRequest_createdAt_idx" ON "ProductRequest"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_createdAt_idx" ON "NotificationOutbox"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

