"use client";

import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/money";
import type { FeeEngineBreakdown } from "@/lib/feeEngine";
import { ShippingCostEditor } from "@/components/ShippingCostEditor";

export interface OrderRowItem {
  title: string;
  quantity: number;
}

// Sellerboard-style order detail: every order shows its order number and
// what was actually sold, and can expand to show exactly which Etsy fee
// lines made up its total (not just the total itself). Fee figures read
// straight off feesBreakdown (computeOrderFees's real output) — nothing
// here is a separate estimate, so it can never drift from the summary line.
// Optional fee lines (gift wrap, multi-quantity, Offsite Ads, currency
// conversion, Regulatory Operating Fee, VAT) are hidden when they're zero,
// so an order with none of those isn't cluttered with a wall of "€0.00"s.
export function OrderRow({
  id,
  receiptId,
  orderDate,
  items,
  grossAmount,
  currency,
  feesBreakdown,
  netProfit,
  profitLabel,
  shippingCostAtSale,
  shippingUnknown,
  assumeNetZero,
}: {
  id: string;
  receiptId: string;
  orderDate: Date;
  items: OrderRowItem[];
  grossAmount: number;
  currency: string | null;
  feesBreakdown: Partial<FeeEngineBreakdown> | null;
  netProfit: number | null;
  profitLabel: string;
  /** The seller's real postage cost for this order, if entered — see
   * ShippingCostEditor and src/lib/profitability.ts. */
  shippingCostAtSale: number | null;
  /** True when profitLabel is specifically "add shipping cost to see
   * profit" — makes that label clickable, expanding straight to the
   * ShippingCostEditor below instead of leaving it as inert text. */
  shippingUnknown: boolean;
  /** Effective shipping mode for this render — the shop's stored default,
   * or the dashboard's view-only override. When true, shipping is assumed
   * to net to zero and no cost editor is shown. */
  assumeNetZero: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasFees = feesBreakdown && typeof feesBreakdown.totalFees === "number";

  const money = (n: number) => formatMoney(n, currency);

  const lines: Array<{ label: string; amount: number }> = [];
  if (hasFees) {
    const b = feesBreakdown!;
    const rates = b.ratesUsed;

    if (typeof b.itemTotal === "number") lines.push({ label: "Item total", amount: b.itemTotal });
    if (typeof b.shippingTotal === "number" && b.shippingTotal !== 0)
      lines.push({ label: "Shipping", amount: b.shippingTotal });
    if (typeof b.giftWrapTotal === "number" && b.giftWrapTotal !== 0)
      lines.push({ label: "Gift wrap", amount: b.giftWrapTotal });

    if (typeof b.transactionFee === "number")
      lines.push({
        label: `Transaction fee (${formatPercent(rates?.transactionFeeRate ?? 0.065)})`,
        amount: -b.transactionFee,
      });
    if (typeof b.paymentProcessingFee === "number" && b.paymentProcessingFee !== 0) {
      const pr = rates?.paymentProcessingRate;
      const label = pr
        ? `Payment processing (${formatPercent(pr.percent)} + ${formatMoney(pr.fixed, pr.fixedCurrency)})`
        : "Payment processing";
      lines.push({ label, amount: -b.paymentProcessingFee });
    }
    if (typeof b.multiQuantityFee === "number" && b.multiQuantityFee !== 0)
      lines.push({ label: "Multi-quantity fee", amount: -b.multiQuantityFee });
    if (typeof b.offsiteAdsFee === "number" && b.offsiteAdsFee !== 0)
      lines.push({
        label: `Offsite Ads fee${rates?.offsiteAdsRate ? ` (${formatPercent(rates.offsiteAdsRate)})` : ""}`,
        amount: -b.offsiteAdsFee,
      });
    if (typeof b.currencyConversionFee === "number" && b.currencyConversionFee !== 0)
      lines.push({
        label: `Currency conversion${rates?.currencyConversionFeeRate ? ` (${formatPercent(rates.currencyConversionFeeRate)})` : ""}`,
        amount: -b.currencyConversionFee,
      });
    if (typeof b.regulatoryOperatingFee === "number" && b.regulatoryOperatingFee !== 0)
      lines.push({
        label: `Regulatory Operating Fee${rates?.regulatoryOperatingFeeRate ? ` (${formatPercent(rates.regulatoryOperatingFeeRate)})` : ""}`,
        amount: -b.regulatoryOperatingFee,
      });
    if (typeof b.vatOnFees === "number" && b.vatOnFees !== 0)
      lines.push({
        label: `VAT on fees${rates?.vatRate ? ` (${formatPercent(rates.vatRate)})` : ""}`,
        amount: -b.vatOnFees,
      });
  }

  const itemsSummary = items.map((i) => (i.quantity > 1 ? `${i.title} ×${i.quantity}` : i.title)).join(", ");

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span>{orderDate.toLocaleDateString()}</span>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Order #{receiptId}</span>
        </div>
        <span>{money(grossAmount)}</span>
        {hasFees && (
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: "0.8rem",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span>fees: {money(feesBreakdown!.totalFees!)}</span>
            <span
              style={{
                display: "inline-block",
                transition: "transform 0.15s",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▾
            </span>
          </button>
        )}
        {shippingUnknown && !assumeNetZero ? (
          <button
            onClick={() => setExpanded(true)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--muted)",
              textDecoration: "underline",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            {profitLabel}
          </button>
        ) : (
          <span className={netProfit !== null ? (netProfit >= 0 ? "profit-positive" : "profit-negative") : ""}>
            {profitLabel}
          </span>
        )}
      </div>

      {itemsSummary && (
        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{itemsSummary}</div>
      )}

      {expanded && hasFees && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: "0.85rem",
            borderTop: "1px solid var(--line)",
            paddingTop: 8,
          }}
        >
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>{line.label}</span>
              <span>{line.amount < 0 ? `-${money(-line.amount)}` : money(line.amount)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, borderTop: "1px solid var(--line)", paddingTop: 4 }}>
            <span>Total fees</span>
            <span>-{money(feesBreakdown!.totalFees!)}</span>
          </div>
          {typeof feesBreakdown!.netToSeller === "number" && (
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
              <span>Net to seller (before cost of goods)</span>
              <span>{money(feesBreakdown!.netToSeller!)}</span>
            </div>
          )}
          {typeof feesBreakdown!.shippingTotal === "number" && feesBreakdown!.shippingTotal !== 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                borderTop: "1px solid var(--line)",
                paddingTop: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--muted)" }}>Your shipping cost</span>
              {assumeNetZero ? (
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  assumed net-zero — excluded from profit
                </span>
              ) : (
                <ShippingCostEditor orderId={id} initialCost={shippingCostAtSale} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
