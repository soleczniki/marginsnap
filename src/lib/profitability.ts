// Phase 2 aggregation logic (PROJECT.md roadmap): grouping orders by day, and
// rolling order-level data up to per-product profitability. Pure functions,
// no Prisma/fetch — takes already-queried data, easy to test in isolation.
//
// Revenue/profit convention (unified 2026-09-13, across every view — order
// card, day group, and Products table): "revenue" always means the FULL
// amount the customer paid (item + shipping + gift wrap — feeEngine's
// orderTotal). Profit then subtracts totalFees, cogsTotal, AND a shipping
// deduction that depends on how this shop treats shipping — see below —
// never a silent assumption either way.
//
// Shipping cost handling (added 2026-09-13, PROJECT.md "shipping cost
// tracking"): Etsy's API only exposes what the BUYER was charged for
// shipping (feesBreakdown.shippingTotal / Order.shippingCost) — never what
// the SELLER actually paid for postage. Every function here takes an
// explicit `assumeNetZero` flag (the shop's stored Shop.assumeShippingNetZero
// default, or the dashboard's view-only override — see dashboard/page.tsx)
// rather than reading it off the shop itself, so callers control which mode
// they're computing:
//   - assumeNetZero = true: the seller has told us they charge buyers the
//     same amount they pay for postage, so shipping revenue and shipping
//     cost cancel out. shippingDeduction = shippingCharged.
//   - assumeNetZero = false (the default): profit needs the REAL cost the
//     seller entered for this order (Order.shippingCostAtSale). If it
//     hasn't been entered yet and shipping was actually charged, the
//     order's profit is unknown — never assumed to be 0 — and
//     shippingUnknown is set so the UI can prompt for it, the same way a
//     missing COGS value does.

import type { Order, OrderLineItem, Listing } from "@prisma/client";
import type { FeeEngineBreakdown } from "@/lib/feeEngine";

export type OrderWithItems = Order & {
  lineItems: (OrderLineItem & { listing: Listing })[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface OrderCogsFees {
  orderTotal: number | null; // feesBreakdown.orderTotal (item + shipping + gift wrap); null until fees resolve
  cogsTotal: number | null; // sum of cogsAtSale * quantity; null if any line item has no cost set
  totalFees: number | null; // feesBreakdown.totalFees; null until sync.ts has resolved it
  shippingCharged: number | null; // feesBreakdown.shippingTotal — what the buyer paid; already inside orderTotal
  shippingDeduction: number | null; // what's actually subtracted from profit for shipping — see file header
  shippingUnknown: boolean; // true only in real-cost mode, when shipping was charged but no cost has been entered yet
  netProfit: number | null; // orderTotal - shippingDeduction - totalFees - cogsTotal, when all four are known
}

/** Same per-order math the dashboard already used for a single order —
 * pulled out here so day grouping and the Products table both build on the
 * one definition of profit (see file header). `assumeNetZero` is the
 * effective shipping mode for this view — the shop's stored default, or the
 * dashboard's view-only override. */
export function orderCogsFees(order: OrderWithItems, assumeNetZero: boolean): OrderCogsFees {
  const breakdown = order.feesBreakdown as Partial<FeeEngineBreakdown> | null;
  const orderTotal = typeof breakdown?.orderTotal === "number" ? breakdown.orderTotal : null;
  const totalFees = typeof breakdown?.totalFees === "number" ? breakdown.totalFees : null;
  const shippingCharged = typeof breakdown?.shippingTotal === "number" ? breakdown.shippingTotal : null;

  const cogsValues = order.lineItems.map((li) => li.cogsAtSale);
  const cogsKnown = cogsValues.length > 0 && cogsValues.every((c) => c !== null);
  const cogsTotal = cogsKnown
    ? round2(
        order.lineItems.reduce((sum, li) => sum + Number(li.cogsAtSale) * li.quantity, 0)
      )
    : null;

  let shippingDeduction: number | null;
  let shippingUnknown = false;
  if (assumeNetZero) {
    // Net-zero: whatever was charged for shipping is also what it "cost" —
    // a wash. If shippingCharged itself hasn't resolved yet, that's a fees-
    // pending state already covered by totalFees/orderTotal being null, so
    // 0 here is safe (never surfaces as a false netProfit on its own).
    shippingDeduction = shippingCharged ?? 0;
  } else if (!shippingCharged) {
    shippingDeduction = 0; // nothing was charged for shipping, so nothing to account for
  } else if (order.shippingCostAtSale !== null && order.shippingCostAtSale !== undefined) {
    shippingDeduction = Number(order.shippingCostAtSale);
  } else {
    shippingDeduction = null;
    shippingUnknown = true;
  }

  const netProfit =
    orderTotal !== null && totalFees !== null && cogsTotal !== null && shippingDeduction !== null
      ? round2(orderTotal - shippingDeduction - totalFees - cogsTotal)
      : null;

  return { orderTotal, cogsTotal, totalFees, shippingCharged, shippingDeduction, shippingUnknown, netProfit };
}

export interface DayGroup {
  dateKey: string; // YYYY-MM-DD, UTC calendar day — see periods.ts header note
  dateLabel: string;
  orders: OrderWithItems[];
  grossTotal: number;
  feesTotal: number | null; // null if any order in the day still has fees pending
  netProfit: number | null; // null if any order's fees, shipping cost, or COGS aren't known yet
  currency: string | null;
}

/** Groups already-fetched orders by their UTC calendar day, newest first. */
export function groupOrdersByDay(orders: OrderWithItems[], assumeNetZero: boolean): DayGroup[] {
  const map = new Map<string, OrderWithItems[]>();
  for (const order of orders) {
    const key = order.orderDate.toISOString().slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(order);
    map.set(key, list);
  }

  const groups: DayGroup[] = [];
  for (const [dateKey, dayOrders] of map) {
    let grossTotal = 0;
    let feesTotal: number | null = 0;
    let netProfit: number | null = 0;

    for (const order of dayOrders) {
      grossTotal += Number(order.grossAmount);
      const { totalFees, netProfit: orderNetProfit } = orderCogsFees(order, assumeNetZero);

      if (totalFees === null) feesTotal = null;
      else if (feesTotal !== null) feesTotal += totalFees;

      if (orderNetProfit === null) netProfit = null;
      else if (netProfit !== null) netProfit += orderNetProfit;
    }

    groups.push({
      dateKey,
      dateLabel: new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC" }),
      orders: dayOrders,
      grossTotal: round2(grossTotal),
      feesTotal: feesTotal !== null ? round2(feesTotal) : null,
      netProfit: netProfit !== null ? round2(netProfit) : null,
      currency: dayOrders[0]?.currency ?? null,
    });
  }

  return groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

export interface ProductAggregate {
  listingId: string;
  title: string;
  sku: string | null;
  /** Etsy's own listing photo (75x75), or null when the listing has none or
   * hasn't been re-synced since thumbnails shipped (2026-09-18) — see
   * Listing.imageUrl in schema.prisma. */
  imageUrl: string | null;
  unitsSold: number;
  /** This product's item revenue PLUS its allocated share of the order's
   * shipping/gift-wrap (split the same way fees are — see allocatedFees).
   * Matches the order card's full total, not just the item price. */
  grossRevenue: number;
  /** This order's totalFees split across its line items by revenue share —
   * Etsy doesn't bill fees per-product, so this is MarginSnap's own
   * allocation, not an Etsy-reported figure. Null if any contributing
   * order's fees haven't synced yet. */
  allocatedFees: number | null;
  /** This product's share of the shipping deduction (0 in net-zero mode;
   * the real postage cost, split the same way, in real-cost mode). Null
   * when shippingUnknown is true. */
  allocatedShipping: number | null;
  /** True when any contributing order charged for shipping but its real
   * postage cost hasn't been entered yet (real-cost mode only). */
  shippingUnknown: boolean;
  cogsTotal: number | null; // null if any contributing line item has no COGS set
  /** Sum of AdSpendEntry rows for this listing whose period overlaps the
   * requested period (see aggregateByListing's adSpendByListing param) —
   * always a number, never null/pending, since "nothing entered" and "$0
   * spent" both mean 0 here. Deliberately NOT part of the "is profit known
   * yet" null-chain the other three cost lines are: unlike COGS/shipping,
   * there's no per-order signal that ad spend even applies, so profit can't
   * meaningfully be blocked on it the way it is on a missing COGS value.
   * The dashboard's disclosure note is what tells the seller this is 0
   * because it's untracked, not because it's genuinely zero. */
  adSpendTotal: number;
  netProfit: number | null;
  currency: string | null;
}

interface Acc {
  listingId: string;
  title: string;
  sku: string | null;
  imageUrl: string | null;
  unitsSold: number;
  revenueSum: number;
  feesSum: number;
  feesUnknown: boolean;
  shippingSum: number;
  shippingUnknown: boolean;
  cogsSum: number;
  cogsUnknown: boolean;
  currency: string | null;
}

/** Rolls a set of orders up into one row per listing — the "which products
 * are actually worth making" table. Fees AND shipping (charged, and its
 * deduction) are all allocated proportional to each line item's share of
 * its order's itemTotal (the only per-product denominator Etsy gives us),
 * so a product's revenue and profit here reconcile with the order-level
 * totals above it — see the file header for the profit convention itself.
 * `assumeNetZero` is the effective shipping mode for this view, same as
 * orderCogsFees. `adSpendByListing` (2026-09-17, Bogdan's request) is the
 * caller's pre-summed AdSpendEntry total per listing for whatever period is
 * being viewed — see dashboard/page.tsx for how that's queried — and is
 * subtracted from each listing's profit here; omit it (or leave a listing
 * out of it) and that listing's ad spend is simply treated as 0, same as
 * before this feature existed. */
export function aggregateByListing(
  orders: OrderWithItems[],
  assumeNetZero: boolean,
  adSpendByListing: Record<string, number> = {}
): ProductAggregate[] {
  const map = new Map<string, Acc>();

  for (const order of orders) {
    const breakdown = order.feesBreakdown as Partial<FeeEngineBreakdown> | null;
    const orderTotalFees = typeof breakdown?.totalFees === "number" ? breakdown.totalFees : null;
    const itemTotal = typeof breakdown?.itemTotal === "number" ? breakdown.itemTotal : null;
    const shippingAndGiftWrap =
      (typeof breakdown?.shippingTotal === "number" ? breakdown.shippingTotal : 0) +
      (typeof breakdown?.giftWrapTotal === "number" ? breakdown.giftWrapTotal : 0);

    const { shippingDeduction, shippingUnknown: orderShippingUnknown } = orderCogsFees(order, assumeNetZero);

    for (const li of order.lineItems) {
      const itemRevenue = Number(li.unitPrice) * li.quantity;
      const revenueShare = itemTotal && itemTotal > 0 ? itemRevenue / itemTotal : 0;

      const acc: Acc = map.get(li.listingId) ?? {
        listingId: li.listingId,
        title: li.listing.title,
        sku: li.listing.sku,
        imageUrl: li.listing.imageUrl,
        unitsSold: 0,
        revenueSum: 0,
        feesSum: 0,
        feesUnknown: false,
        shippingSum: 0,
        shippingUnknown: false,
        cogsSum: 0,
        cogsUnknown: false,
        currency: order.currency,
      };

      acc.unitsSold += li.quantity;
      acc.revenueSum += itemRevenue + shippingAndGiftWrap * revenueShare;

      if (orderTotalFees === null) {
        acc.feesUnknown = true;
      } else if (itemTotal && itemTotal > 0) {
        acc.feesSum += orderTotalFees * revenueShare;
      } // else: legitimately nothing to allocate (no item revenue on this order)

      if (orderShippingUnknown) {
        acc.shippingUnknown = true;
      } else if (shippingDeduction !== null && itemTotal && itemTotal > 0) {
        acc.shippingSum += shippingDeduction * revenueShare;
      } // else: nothing to allocate (net-zero mode with nothing charged, or no item revenue)

      if (li.cogsAtSale !== null) acc.cogsSum += Number(li.cogsAtSale) * li.quantity;
      else acc.cogsUnknown = true;

      map.set(li.listingId, acc);
    }
  }

  const results: ProductAggregate[] = Array.from(map.values()).map((acc) => {
    const allocatedFees = acc.feesUnknown ? null : round2(acc.feesSum);
    const allocatedShipping = acc.shippingUnknown ? null : round2(acc.shippingSum);
    const cogsTotal = acc.cogsUnknown ? null : round2(acc.cogsSum);
    const adSpendTotal = round2(adSpendByListing[acc.listingId] ?? 0);
    const grossRevenue = round2(acc.revenueSum);
    const netProfit =
      allocatedFees !== null && allocatedShipping !== null && cogsTotal !== null
        ? round2(grossRevenue - allocatedFees - allocatedShipping - cogsTotal - adSpendTotal)
        : null;
    return {
      listingId: acc.listingId,
      title: acc.title,
      sku: acc.sku,
      imageUrl: acc.imageUrl,
      unitsSold: acc.unitsSold,
      grossRevenue,
      allocatedFees,
      allocatedShipping,
      shippingUnknown: acc.shippingUnknown,
      cogsTotal,
      adSpendTotal,
      netProfit,
      currency: acc.currency,
    };
  });

  return results.sort((a, b) => {
    if (a.netProfit === null && b.netProfit === null) return b.grossRevenue - a.grossRevenue;
    if (a.netProfit === null) return 1;
    if (b.netProfit === null) return -1;
    return b.netProfit - a.netProfit;
  });
}
