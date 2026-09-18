-- AlterTable
ALTER TABLE "ad_spend_entries" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "imageUrl" TEXT;
