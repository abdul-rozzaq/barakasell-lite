-- Squashed migration: discounts move from percentages to flat so'm sums.
-- Percentages of odd prices produced ugly fractional amounts (e.g. 8559).

-- AlterTable: Sale's overall discount is now a flat sum entered at
-- checkout, not a percentage of subtotal.
ALTER TABLE "Sale" DROP COLUMN "discountPct";

-- AlterTable: ProductUnit gets a standing discount, set by an admin, as a
-- flat sum off the unit's price.
ALTER TABLE "ProductUnit" ADD COLUMN     "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable: SaleLine keeps a snapshot of the per-unit discount sum
-- actually applied at sale time (renamed from the old percentage column;
-- existing values are historical percentages, kept as-is since they're
-- audit-only and not recomputed).
ALTER TABLE "SaleLine" RENAME COLUMN "discountPct" TO "unitDiscountAmount";
ALTER TABLE "SaleLine" ALTER COLUMN "unitDiscountAmount" TYPE DECIMAL(14,2);
