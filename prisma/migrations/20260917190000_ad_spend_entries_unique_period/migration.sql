-- Fixes a re-import footgun: pasting/screenshotting the same Etsy ads
-- report twice for the same listing used to create a second AdSpendEntry
-- row, and profitability.ts would sum both, silently doubling that
-- listing's ad spend. This makes (listingId, periodStart, periodEnd) the
-- key for one report, and /api/ad-spend/save now upserts on it, so a
-- re-import corrects the existing entry's amount instead of duplicating it.
-- Two different (even overlapping) periods for the same listing are still
-- both kept on purpose.

-- DropIndex
DROP INDEX "ad_spend_entries_listingId_periodStart_periodEnd_idx";

-- AlterTable
ALTER TABLE "ad_spend_entries" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "ad_spend_entries_listingId_periodStart_periodEnd_key" ON "ad_spend_entries"("listingId", "periodStart", "periodEnd");
