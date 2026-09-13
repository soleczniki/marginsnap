// One-off diagnostic: dump every Order + its line items exactly as stored in
// the database, raw — no Etsy API call needed, since we already have live
// synced data to look at. Confirms (or rules out) whether stored amounts are
// un-divided Etsy Money values (amount/divisor) and how many Order rows
// actually exist, before touching sync.ts.
//
// Run on your own machine, from the project root:
//   npx tsx scripts/inspect-orders.ts
//
// Uses the same DATABASE_URL your app already runs on (from .env.local /
// wherever your shell picks up env vars) via the same Prisma client the app
// uses — nothing new to configure.

import { prisma } from "../src/lib/db";

function replacer(_key: string, value: unknown) {
  // BigInt (etsyReceiptId, etsyListingId) has no default JSON serialization.
  return typeof value === "bigint" ? value.toString() : value;
}

async function main() {
  const orders = await prisma.order.findMany({
    orderBy: { orderDate: "desc" },
    include: {
      lineItems: { include: { listing: true } },
      shop: { select: { shopName: true, etsyShopId: true } },
    },
  });

  console.log(`Found ${orders.length} order row(s) in the database.\n`);
  console.log(JSON.stringify(orders, replacer, 2));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
