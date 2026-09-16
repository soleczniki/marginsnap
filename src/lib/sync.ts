import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import {
  extractUserIdFromAccessToken,
  getShopForUser,
  listActiveListings,
  listReceiptsSince,
  refreshAccessToken,
} from "@/lib/etsy";
import { computeOrderFees, type FeeEngineLineItem } from "@/lib/feeEngine";
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
//   on the `?? {}` fallback. Real fee figures now come from feeEngine.ts's
//   computeOrderFees() — see below for how its inputs are sourced per shop.
//
// Fee-engine inputs (per shop, never hardcoded — every connected shop can be
// a different seller in a different country with a different VAT status):
// - sellerCountry: pulled fresh from Etsy's shop_location_country_iso on
//   every sync (confirmed as a real Shop-resource field — see the field
//   list at https://raw.githubusercontent.com/gordonturner/etsy-open-api-client/main/docs/Shop.md).
// - sellerHasValidVatId: Etsy's API has no field for this anywhere — it's
//   the one input each seller sets themselves, on /dashboard/settings.
// - Offsite Ads attribution isn't present on the receipt/transaction
//   objects either, so offsiteAdsAttributed is always false for now — that
//   fee line is 0 until Etsy exposes it or we find another source for it.
//
// grossAmount/shippingCost/feesBreakdown are recomputed on every sync (not
// just on first insert) — nothing on Order is seller-edited, so there's no
// user input to protect by leaving it alone. That also means re-syncing
// after this fix corrects any order synced before it, automatically.

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

  // ---------- Seller country (fee engine input #1) ----------
  // Refetched every sync, not cached forever — a seller could move, and this
  // is cheap (one call, already-open connection). Falls back to whatever's
  // already stored if this call doesn't return one, rather than clobbering
  // a known-good value with null.
  //
  // shop_location_country_iso is a real field (confirmed against a live
  // response via scripts/diag-shop-route.ts on 2026-09-13) but can genuinely
  // be null — this shop never filled that setting in. shipping_from_country_iso
  // was populated on the same real shop, so it's the fallback: still a real
  // Etsy-reported field per shop, never a hardcoded guess.
  const etsyUserId = extractUserIdFromAccessToken(accessToken);
  const shopInfo = await getShopForUser(accessToken, etsyUserId);
  const shopRecord = shopInfo?.shop_id ? shopInfo : shopInfo?.results?.[0];
  const sellerCountry: string | null =
    shopRecord?.shop_location_country_iso ?? shopRecord?.shipping_from_country_iso ?? shop.sellerCountry ?? null;
  if (sellerCountry && sellerCountry !== shop.sellerCountry) {
    await prisma.shop.update({ where: { id: shop.id }, data: { sellerCountry } });
  }

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
  // Always re-fetch a rolling 90-day window — NOT "only receipts created since
  // the last sync". This isn't just about catching new orders: whenever the
  // computation itself changes (a money-field fix, the fee engine going in,
  // the currency field being added), already-synced orders need to be
  // recomputed too, and the only way that happens is if this loop sees them
  // again. Using shop.lastSyncedAt as the cursor silently froze every order
  // at whatever values it got on its first sync — that's exactly the bug
  // that showed up as an order stuck at $300/no currency no matter how many
  // times "Sync now" was clicked, after the underlying fix had shipped.
  // Order volume for a solo seller is small enough that re-fetching (and
  // re-upserting) 90 days of receipts on every sync is cheap.
  const minCreated = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

  const receipts = await listReceiptsSince(accessToken, shop.etsyShopId.toString(), minCreated);
  let ordersSynced = 0;

  for (const receipt of receipts?.results ?? []) {
    const shippingCost = money(receipt.total_shipping_cost);
    const grossAmount = money(receipt.grandtotal);
    // Real ISO 4217 code from the receipt itself — never assumed/hardcoded,
    // since a shop's orders could in principle span currencies.
    const currency: string | null = receipt.grandtotal?.currency_code ?? null;

    const order = await prisma.order.upsert({
      where: { shopId_etsyReceiptId: { shopId: shop.id, etsyReceiptId: BigInt(receipt.receipt_id) } },
      create: {
        shopId: shop.id,
        etsyReceiptId: BigInt(receipt.receipt_id),
        orderDate: new Date(receipt.created_timestamp * 1000),
        grossAmount,
        currency,
        feesBreakdown: {}, // filled in below once resolvedItems/fee input are known
        shippingCost,
      },
      update: { grossAmount, currency, shippingCost }, // see file header — recomputed every sync, nothing here is seller-edited
    });

    // Resolve each transaction's listing/cost context once, reused for both
    // the fee-engine input and the per-line-item upserts below.
    const resolvedItems: Array<{
      transaction: (typeof receipt.transactions)[number];
      listing: NonNullable<Awaited<ReturnType<typeof prisma.listing.findUnique>>>;
      cogs: number | null;
      unitPrice: number;
    }> = [];

    for (const transaction of receipt.transactions ?? []) {
      const listing = await prisma.listing.findUnique({
        where: { shopId_etsyListingId: { shopId: shop.id, etsyListingId: BigInt(transaction.listing_id) } },
      });
      if (!listing) continue; // no matching listing synced — same as before, this line item is skipped

      resolvedItems.push({ transaction, listing, cogs: listing.cogsAmount ? Number(listing.cogsAmount) : null, unitPrice: money(transaction.price) });
    }

    // ---------- Real fee computation (feeEngine.ts) ----------
    // `currency` computed above, alongside grossAmount/shippingCost — if it's
    // ever actually missing, fees are skipped for this order rather than
    // guessed at (see file header: every real Money object carries it).
    if (sellerCountry && currency) {
      const lineItems: FeeEngineLineItem[] = [];
      for (const { transaction, listing, unitPrice } of resolvedItems) {
        // "First unit ever sold on this listing" = no other order's line item
        // for this listing exists yet (excluding this order itself, so a
        // re-sync of the same order doesn't count its own prior run).
        const priorSaleCount = await prisma.orderLineItem.count({
          where: { listingId: listing.id, orderId: { not: order.id } },
        });
        lineItems.push({
          listingId: listing.id,
          quantity: transaction.quantity ?? 1,
          unitPrice,
          isFirstUnitSoldOnListing: priorSaleCount === 0,
        });
      }

      const feesBreakdown = computeOrderFees({
        currency,
        lineItems,
        shippingCharged: shippingCost,
        giftWrapCharged: money(receipt.gift_wrap_price),
        sellerCountry,
        sellerHasValidVatId: shop.sellerHasValidVatId,
        // Offsite Ads attribution isn't on the receipt/transaction objects —
        // see file header. Always "not attributed" until that data exists.
        offsiteAdsAttributed: false,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { feesBreakdown: feesBreakdown as unknown as object },
      });
    }
    // else: sellerCountry never resolved, or this receipt had no currency —
    // feesBreakdown stays {} until a future sync has both.

    for (const { transaction, listing, cogs, unitPrice } of resolvedItems) {
      const lineProfit = cogs !== null ? unitPrice - cogs : null; // fee/shipping share TODO
      const quantity = transaction.quantity ?? 1;

      await prisma.orderLineItem.upsert({
        where: { id: `${order.id}:${listing.id}` }, // placeholder composite — see file header note in cron route
        create: {
          id: `${order.id}:${listing.id}`,
          orderId: order.id,
          listingId: listing.id,
          quantity,
          unitPrice,
          cogsAtSale: cogs,
          lineProfit,
        },
        // unitPrice/quantity recomputed every sync too, not just cogsAtSale/
        // lineProfit — same reasoning as Order's fields (file header): none
        // of this is seller-edited. Without this, a line item created before
        // a computation fix (the money()/divisor fix, in this case) stays
        // frozen at its old wrong value forever, the same class of bug the
        // sync-window fix addressed at the Order level. Found via the
        // Products table showing €200 revenue on a real €2 item.
        update: { unitPrice, quantity, cogsAtSale: cogs, lineProfit },
      });
    }

    // ---------- Shipping-cost default (PROJECT.md "flat/default shipping
    // cost", 2026-09-16) ----------
    // Only when this order's shippingCostAtSale is still null (never
    // overwrites a real value the seller entered or corrected by hand —
    // true whether this order is brand new or was already synced and just
    // never touched) AND every line item on it is the SAME listing (a
    // multi-product order is left alone; combining two different defaults
    // into one package's cost isn't a safe guess — see
    // apply-default-shipping-cost/route.ts for the same rule applied
    // on-demand to existing orders).
    if (order.shippingCostAtSale === null && resolvedItems.length > 0) {
      const distinctListingIds = new Set(resolvedItems.map((ri) => ri.listing.id));
      if (distinctListingIds.size === 1) {
        const onlyListing = resolvedItems[0].listing;
        if (onlyListing.defaultShippingCost !== null) {
          await prisma.order.update({
            where: { id: order.id },
            data: { shippingCostAtSale: onlyListing.defaultShippingCost },
          });
        }
      }
    }

    ordersSynced++;
  }

  await prisma.shop.update({ where: { id: shop.id }, data: { lastSyncedAt: new Date() } });

  return { listingsSynced, ordersSynced };
}
