-- CreateIndex
CREATE INDEX "CustomerDebtEntry_refType_refId_idx" ON "CustomerDebtEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "CustomerDebtEntry_occurredAt_idx" ON "CustomerDebtEntry"("occurredAt");

-- CreateIndex
CREATE INDEX "Sale_status_soldAt_idx" ON "Sale"("status", "soldAt");

-- CreateIndex
CREATE INDEX "SaleReturn_shiftId_idx" ON "SaleReturn"("shiftId");

-- CreateIndex
CREATE INDEX "SaleReturnLine_saleLineId_idx" ON "SaleReturnLine"("saleLineId");
