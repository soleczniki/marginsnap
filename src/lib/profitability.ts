// Phase 2 aggregation logic (PROJECT.md roadmap): grouping orders by day, and
// rolling order-level data up to per-product profitability. Pure functions,
// no Prisma/fetch — takes already-queried data, easy to test in isolation.

import type { Order, OrderLineItem, Listing } from "@prisma/client";
import type { FeeEngineBreakdown } from "@/lib/feeEngine";

export type OrderWithItems = Order & {
  lineItems: (OrderLineItem & { listing: Listing })[];
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface OrderCogsFees {
  cogsProfit: number | null; // sum of lineProfit across the order's line items; null if any is unknown
  totalFees: number | null; // feesBreakdown.totalFees; null until sync.ts has resolved it
  netProfit: number | null; // cogsProfit - totalFees, when both are known
}

/** Same per-order math the dashboard already used for a single order —
 * pulled out here so day grouping can reuse it without duplicating it. */
export function orderCogsFees(order: OrderWithItems): OrderCogsFees {
  const cogsProfits = order.lineItems.map((li) => li.lineProfit);
  const cogsKnown = cogsProfits.length > 0 && cogsProfits.every((p) => p !== null);
  const cogsProfit = cogsKnown ? cogsProfits.reduce((sum, p) => sum + Number(p), 0) : null;

  const breakdown = order.feesBreakdown as Partial<FeeEngineBreakdown> | null;
  const totalFees = typeof breakdown?.totalFees === "number" ? breakdown.totalFees : null;

  const netProfit = cogsProfit !== null && totalFees !== null ? cogsProfit - totalFees : null;

  return { cogsProfit, totalFees, netProfit };
}

export interface DayGroup {
  dateKey: string; // YYYY-MM-DD, UTC calendar day — see periods.ts header note
  dateLabel: string;
  orders: OrderWithItems[];
  grossTotal: number;
  feesTotal: number | null; // null if any order in the day still has fees pending
  netProfit: number | null; // null if any order's fees or COGS aren't known yet
  currency: string | null;
}

/** Groups already-fetched orders by their UTC calendar day, newest first. */
export function groupOrdersByDay(orders: OrderWithItems[]): DayGroup[] {
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
      const { cogsProfit, totalFees } = orderCogsFees(order);

      if (totalFees === null) feesTotal = null;
      else if (feesTotal !== null) feesTotal += totalFees;

      if (totalFees === null || cogsProfit === null) netProfit = null;
      else if (netProfit !== null) netProfit += cogsProfit - totalFees;
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
  unitsSold: number;
  grossRevenue: number;
  /** This order's totalFees split across its line items by revenue share —
   * Etsy doesn't bill fees per-product, so this is MarginSnap's own
   * allocation, not an Etsy-reported figure. Null if any contributing
   * order's fees haven't synced yet. */
  allocatedFees: number | null;
  cogsTotal: number | null; // null if any contributing line item has no COGS set
  netProfit: number | null;
  currency: string | null;
}

interface Acc {
  listingId: string;
  title: string;
  sku: string | null;
  unitsSold: number;
  grossRevenue: number;
  feesSum: number;
  feesUnknown: boolean;
  cogsSum: number;
  cogsUnknown: boolean;
  currency: string | null;
}

/** Rolls a set of orders up into one row per listing — the "which products
 * are actually worth making" table. Fee allocation is proportional to each
 * line item's share of its order's itemTotal (shipping/gift-wrap aren't
 * tied to a specific product, so they're left out of the split). */
export function aggregateByListing(orders: OrderWithItems[]): ProductAggregate[] {
  const map = new Map<string, Acc>();

  for (const order of orders) {
    const breakdown = order.feesBreakdown as Partial<FeeEngineBreakdown> | null;
    const orderTotalFees = typeof breakdown?.totalFees === "number" ? breakdown.totalFees : null;
    const itemTotal = typeof breakdown?.itemTotal === "number" ? breakdown.itemTotal : null;

    for (const li of order.lineItems) {
      const revenue = Number(li.unitPrice) * li.quantity;
      const acc: Acc = map.get(li.listingId) ?? {
        listingId: li.listingId,
        title: li.listing.title,
        sku: li.listing.sku,
        unitsSold: 0,
        grossRevenue: 0,
        feesSum: 0,
        feesUnknown: false,
        cogsSum: 0,
        cogsUnknown: false,
        currency: order.currency,
      };

      acc.unitsSold += li.quantity;
      acc.grossRevenue += revenue;

      if (orderTotalFees === null) {
        acc.feesUnknown = true;
      } else if (itemTotal && itemTotal > 0) {
        acc.feesSum += orderTotalFees * (revenue / itemTotal);
      } // else: legitimately nothing to allocate (no item revenue on this order)

      if (li.cogsAtSale !== null) acc.cogsSum += Number(li.cogsAtSale) * li.quantity;
      else acc.cogsUnknown = true;

      map.set(li.listingId, acc);
    }
  }

  const results: ProductAggregate[] = Array.from(map.values()).map((acc) => {
    const allocatedFees = acc.feesUnknown ? null : round2(acc.feesSum);
    const cogsTotal = acc.cogsUnknown ? null : round2(acc.cogsSum);
    const netProfit =
      allocatedFees !== null && cogsTotal !== null
        ? round2(acc.grossRevenue - allocatedFees - cogsTotal)
        : null;
    return {
      listingId: acc.listingId,
      title: acc.title,
      sku: acc.sku,
      unitsSold: acc.unitsSold,
      grossRevenue: round2(acc.grossRevenue),
      allocatedFees,
      cogsTotal,
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
