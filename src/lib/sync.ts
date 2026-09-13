import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { listActiveListings, listReceiptsSince, refreshAccessToken } from "@/lib/etsy";
import type { Shop } from "@prisma/client";

// Shared sync logic — pulls one shop's listings + orders from Etsy and writes
// them to our database. Used by both the daily cron job (src/app/api/cron/sync)
// and the "run this one shop right now" paths (right after connecting, and the
// manual "Sync now" button) so there's exactly one place that does the real work.
//
// Confirmed against a real /receipts response on 2026-09-13 (see
// scripts/diag-receipts-route.ts / etsy-verify.ts):
//
// - Every money field Etsy returns (grandtotal, total_shipping_cost,
//   transaction.price, etc.) is a Money object: { amount, divisor,
//   currency_code } — the real value is amount / divisor (divisor was 100
//   in the sample, i.e. amounts are in minor units/cents). Previously this
//   file used `.amount` directly, which overstated every money figure by
//   100x (a real €3.00 order showed as $300).
// - receipt.fees does not exist on the real response at all (not even as
//   an empty object) — the old `receipt.fees ?? {}` always silently landed
//   on the `?? {}` fallback. Real fee figures should come from
//   feeEngine.ts's computeOrderFees() instead — see the TODO below for the
//   one open gap (seller country / VAT status aren't stored anywhere yet).

function money(m: { amount: number; divisor: number } | null | undefined): number {
  if (!m || !m.divisor) return 0;
  return m.amount / m.divisor;
}

export async function syncShop(shop: Shop): Promise<{ listingsSynced: number; ordersSynced: number }> {
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

  if (!shop.etsyShopId) throw new Error("shop has no etsyShopId on record");

  // ---------- Listings ----------
  // (Previously missing entirely — without this, no order line item could
  // ever match a listing, so profit could never be calculated for anyone.)
  let listingsSynced = 0;
  const listingsResponse = await listActiveListings(accessToken, shop.etsyShopId.toString());
  for (const listing of listingsResponse?.results ?? []) {
    await prisma.listing.upsert({
      where: { shopId_etsyListingId: { shopId: shop.id, etsyListingId: BigInt(listing.listing_id) } },
      create: {
        shopId: shop.id,
        etsyListingId: BigInt(listing.listing_id),
        title: listing.title ?? "Untitled listing",
        sku: listing.skus?.[0] ?? null,
      },
      update: {
        title: listing.title ?? "Untitled listing",
      },
    });
    listingsSynced++;
  }

  // ---------- Orders / receipts ----------
  const minCreated = shop.lastSyncedAt
    ? Math.floor(shop.lastSyncedAt.getTime() / 1000)
    : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000); // first sync: 90-day backfill

  const receipts = await listReceiptsSince(accessToken, shop.etsyShopId.toString(), minCreated);
  let ordersSynced = 0;

  for (const receipt of receipts?.results ?? []) {
    const order = await prisma.order.upsert({
      where: { shopId_etsyReceiptId: { shopId: shop.id, etsyReceiptId: BigInt(receipt.receipt_id) } },
      create: {
        shopId: shop.id,
        etsyReceiptId: BigInt(receipt.receipt_id),
        orderDate: new Date(receipt.created_timestamp * 1000),
        grossAmount: money(receipt.grandtotal),
        // TODO(fee engine wiring): feeEngine.ts's computeOrderFees() needs
        // sellerCountry + sellerHasValidVatId, and neither is stored on Shop
        // yet — see PROJECT.md. Left as {} rather than a guessed country
        // until that's decided; do not read this as "no fees" in the UI.
        feesBreakdown: {},
        shippingCost: money(receipt.total_shipping_cost),
      },
      update: {}, // orders are immutable once synced; only line-item profit recalculates
    });

    for (const transaction of receipt.transactions ?? []) {
      const listing = await prisma.listing.findUnique({
        where: { shopId_etsyListingId: { shopId: shop.id, etsyListingId: BigInt(transaction.listing_id) } },
      });

      const cogs = listing?.cogsAmount ? Number(listing.cogsAmount) : null;
      const unitPrice = money(transaction.price);
      const lineProfit = cogs !== null ? unitPrice - cogs : null; // fee/shipping share TODO

      if (listing) {
        await prisma.orderLineItem.upsert({
          where: { id: `${order.id}:${listing.id}` }, // placeholder composite — see file header note in cron route
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

  return { listingsSynced, ordersSynced };
}
