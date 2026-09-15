-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "shippingCostAtSale" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "assumeShippingNetZero" BOOLEAN NOT NULL DEFAULT false;
