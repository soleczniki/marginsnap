-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "sellerCountry" TEXT,
ADD COLUMN     "sellerHasValidVatId" BOOLEAN NOT NULL DEFAULT false;
