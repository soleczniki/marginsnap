import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { listReceiptsSince, refreshAccessToken } from "@/lib/etsy";

// The scheduled sync job (Blueprint workflow §3 / Architecture diagram's
// "cron sync job" box). Configured in vercel.json to run every 15 minutes;
// Vercel Cron calls this with the CRON_SECRET as a bearer token.
//
// ⚠️ The fee/shipping math below (feesBreakdown, shippingCost) is a stub —
// it needs the real shape of Etsy's receipt response (which fields carry
// transaction fees, payment processing fees, and shipping) verified against
// a live API call before this produces a trustworthy profit number. Wiring
// that up correctly is the actual point of Phase 2, step 4 in the roadmap —
// don't trust this file's numbers until that's done.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shops = await prisma.shop.findMany({
    where: { marketplace: "etsy", accessTokenEnc: { not: null } },
  });

  const results: Array<{ shopId: string; ordersSynced: number; error?: string }> = [];

  for (const shop of shops) {
    try {
      let accessToken = decryptToken(shop.accessTokenEnc!);

      // Refresh proactively if the token is expired or about to be.
      if (!shop.tokenExpiresAt || shop.tokenExpiresAt.getTime() < Date.now() + 60_000) {
        const refreshed = await refreshAccessToken(decryptToken(shop.refreshTokenEnc!));
        accessToken = refreshed.access_token;
        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            accessTokenEnc: encryptToken(refreshed.access_token),
            refreshTokenEnc: encryptToken(refreshed.refresh_token),
            tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
          },
        });
      }

      const minCreated = shop.lastSyncedAt
        ? Math.floor(shop.lastSyncedAt.getTime() / 1000)
        : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000); // first sync: 90-day backfill

      if (!shop.etsyShopId) throw new Error("shop has no etsyShopId on record");

      const receipts = await listReceiptsSince(accessToken, shop.etsyShopId.toString(), minCreated);
      let ordersSynced = 0;

      for (const receipt of receipts?.results ?? []) {
        // ⚠️ Field names below are placeholders pending a real response shape — see file header.
        const order = await prisma.order.upsert({
          where: { shopId_etsyReceiptId: { shopId: shop.id, etsyReceiptId: BigInt(receipt.receipt_id) } },
          create: {
            shopId: shop.id,
            etsyReceiptId: BigInt(receipt.receipt_id),
            orderDate: new Date(receipt.created_timestamp * 1000),
            grossAmount: receipt.grandtotal?.amount ?? 0,
            feesBreakdown: receipt.fees ?? {},
            shippingCost: receipt.total_shipping_cost?.amount ?? 0,
          },
          update: {}, // orders are immutable once synced; only line-item profit recalculates
        });

        for (const transaction of receipt.transactions ?? []) {
          const listing = await prisma.listing.findUnique({
            where: { shopId_etsyListingId: { shopId: shop.id, etsyListingId: BigInt(transaction.listing_id) } },
          });

          const cogs = listing?.cogsAmount ? Number(listing.cogsAmount) : null;
          const unitPrice = transaction.price?.amount ?? 0;
          const lineProfit = cogs !== null ? unitPrice - cogs : null; // fee/shipping share TODO — see file header

          if (listing) {
            await prisma.orderLineItem.upsert({
              where: { id: `${order.id}:${listing.id}` }, // placeholder composite — replace with a real unique constraint once schema is finalized
              create: {
                id: `${order.id}:${listing.id}`,
                orderId: order.id,
                listingId: listing.id,
                quantity: transaction.quantity ?? 1,
                unitPrice,
                cogsAtSale: cogs,
                lineProfit,
              },
              update: { cogsAtSale: cogs, lineProfit },
            });
          }
        }
        ordersSynced++;
      }

      await prisma.shop.update({ where: { id: shop.id }, data: { lastSyncedAt: new Date() } });
      results.push({ shopId: shop.id, ordersSynced });
    } catch (err) {
      results.push({ shopId: shop.id, ordersSynced: 0, error: (err as Error).message });
    }
  }

  return NextResponse.json({ synced: results });
}
