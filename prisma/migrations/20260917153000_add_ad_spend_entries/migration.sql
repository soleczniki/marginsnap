-- CreateTable
CREATE TABLE "ad_spend_entries" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountSpent" DECIMAL(10,2) NOT NULL,
    "currency" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_spend_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_spend_entries_listingId_periodStart_periodEnd_idx" ON "ad_spend_entries"("listingId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "ad_spend_entries" ADD CONSTRAINT "ad_spend_entries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
