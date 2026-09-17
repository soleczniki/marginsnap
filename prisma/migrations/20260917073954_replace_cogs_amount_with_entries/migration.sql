/*
  Warnings:

  - You are about to drop the column `cogsAmount` on the `listings` table.
    Existing non-null values are preserved below by seeding them into
    `cogs_entries` as a retroactive entry (effectiveFrom = 1970-01-01, i.e.
    "applies to every order") before the column is dropped, so no seller's
    cost disappears as part of this migration.

*/
-- CreateTable
CREATE TABLE "cogs_entries" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "cogsAmount" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cogs_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cogs_entries_listingId_effectiveFrom_idx" ON "cogs_entries"("listingId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "cogs_entries" ADD CONSTRAINT "cogs_entries_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration (hand-added, not Prisma-generated): seed one retroactive
-- cogs_entries row per listing that already had a cogsAmount, BEFORE that
-- column gets dropped below — so existing costs carry over instead of
-- silently resetting to "not set" for every listing that had one.
INSERT INTO "cogs_entries" ("id", "listingId", "cogsAmount", "effectiveFrom", "createdAt")
SELECT gen_random_uuid()::text, "id", "cogsAmount", '1970-01-01T00:00:00.000Z'::timestamp(3), CURRENT_TIMESTAMP
FROM "listings"
WHERE "cogsAmount" IS NOT NULL;

-- AlterTable
ALTER TABLE "listings" DROP COLUMN "cogsAmount";
