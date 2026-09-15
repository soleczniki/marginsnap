"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { OrderRow, type OrderRowItem } from "@/components/OrderRow";
import type { FeeEngineBreakdown } from "@/lib/feeEngine";

export interface DayOrder {
  id: string;
  receiptId: string;
  orderDate: Date;
  items: OrderRowItem[];
  grossAmount: number;
  currency: string | null;
  feesBreakdown: Partial<FeeEngineBreakdown> | null;
  netProfit: number | null;
  profitLabel: string;
  shippingCostAtSale: number | null;
}

// One row per day (Sellerboard's day-by-day view) — expands to the
// individual orders that made up the day, each of which can expand further
// to its own fee breakdown. A day with only one order skips this wrapper
// entirely (see dashboard/page.tsx) since there's nothing to compact.
export function DayGroup({
  dateLabel,
  orders,
  grossTotal,
  feesTotal,
  netProfit,
  currency,
  assumeNetZero,
}: {
  dateLabel: string;
  orders: DayOrder[];
  grossTotal: number;
  feesTotal: number | null;
  netProfit: number | null;
  currency: string | null;
  assumeNetZero: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const money = (n: number) => formatMoney(n, currency);

  let netLabel: string;
  if (netProfit !== null) netLabel = `${netProfit >= 0 ? "+" : ""}${money(netProfit)}`;
  else if (feesTotal === null) netLabel = "fees pending";
  else netLabel = "cost pending";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          color: "inherit",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{ display: "inline-block", transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
          {dateLabel}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {orders.length} order{orders.length === 1 ? "" : "s"}
        </span>
        <span>{money(grossTotal)}</span>
        {feesTotal !== null && (
          <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>fees: {money(feesTotal)}</span>
        )}
        <span className={netProfit !== null ? (netProfit >= 0 ? "profit-positive" : "profit-negative") : ""}>
          {netLabel}
        </span>
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              id={order.id}
              receiptId={order.receiptId}
              orderDate={order.orderDate}
              items={order.items}
              grossAmount={order.grossAmount}
              currency={order.currency}
              feesBreakdown={order.feesBreakdown}
              netProfit={order.netProfit}
              profitLabel={order.profitLabel}
              shippingCostAtSale={order.shippingCostAtSale}
              assumeNetZero={assumeNetZero}
            />
          ))}
        </div>
      )}
    </div>
  );
}
