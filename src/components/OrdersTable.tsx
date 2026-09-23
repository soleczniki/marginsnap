"use client";

import { useState, type CSSProperties } from "react";
import { formatMoney, formatPercent } from "@/lib/money";
import type { FeeEngineBreakdown } from "@/lib/feeEngine";
import { ShippingCostEditor } from "@/components/ShippingCostEditor";

export interface OrderRowItem {
  title: string;
  quantity: number;
  /** Etsy's listing photo (75x75), or null — see Listing.imageUrl. */
  imageUrl: string | null;
  /** For linking the thumbnail straight to the live Etsy listing
   * (2026-09-18, Bogdan's request) — see ProductAggregate.etsyListingId. */
  etsyListingId: string;
}

export interface OrderTableRow {
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
   * profit" — makes the row clickable straight to the shipping editor. */
  shippingUnknown: boolean;
  /** The one listing this order is for, or null when it has more than one
   * distinct listing — passed straight through to ShippingCostEditor's
   * "Save and apply to all orders without shipping cost" action. */
  singleListingId: string | null;
}

const thStyle: CSSProperties = { padding: "8px 10px", color: "var(--muted)", fontWeight: 600, fontSize: "0.8rem", textAlign: "left" };
const tdStyle: CSSProperties = { padding: "10px", borderBottom: "1px solid var(--line)", verticalAlign: "top" };
// Numeric/money columns (Revenue, Fees, Shipping, Profit) shouldn't ever
// wrap mid-value — that's what was making the table look ragged before the
// dashboard went full-width.
const tdNumStyle: CSSProperties = { ...tdStyle, whiteSpace: "nowrap" };
// Thumbnails (2026-09-18, Bogdan's request; enlarged 2026-09-22 — 40px read
// too small once real photos were actually showing): a fixed-size box so the
// row height stays consistent whether or not a given listing has a photo yet
// — thumbPlaceholderStyle renders the same size when imageUrl is null so an
// unphotographed listing doesn't collapse the column.
const thumbSize = 56;
const thumbStyle: CSSProperties = {
  width: thumbSize,
  height: thumbSize,
  borderRadius: 6,
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid var(--line)",
};
const thumbPlaceholderStyle: CSSProperties = {
  ...thumbStyle,
  background: "var(--surface-2)",
  border: "1px solid var(--line)",
};
// Thumbnail+title → live Etsy listing, new tab (2026-09-18, Bogdan's
// request). color/textDecoration reset so it reads as normal row content,
// not a typical blue underlined link.
const listingLinkStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  color: "inherit",
  textDecoration: "none",
};
const expandButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  padding: 0,
  font: "inherit",
};
const linkButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "var(--muted)",
  textDecoration: "underline",
  cursor: "pointer",
  font: "inherit",
};

// Sellerboard-style flat orders ledger (2026-09-17 redesign, Bogdan's
// request) — replaces the old day-grouped card stack (DayGroup.tsx +
// OrderRow.tsx) with one real <table>, one row per order, sorted newest
// first (day subtotals dropped for simplicity — the Date column already
// carries that; can come back as an optional "group by day" toggle later
// if it's missed). The fee-breakdown expand and inline shipping-cost editor
// behave exactly as they did in the old card view, just inside a <tr> that
// spans every column instead of a nested div. Horizontal scroll (not a
// second stacked-card layout) is the mobile fallback — see PROJECT.md.
export function OrdersTable({ orders, assumeNetZero }: { orders: OrderTableRow[]; assumeNetZero: boolean }) {
  if (orders.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No orders in this period.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Order</th>
            <th style={thStyle}>Revenue</th>
            <th style={thStyle}>Fees</th>
            <th style={thStyle}>Shipping</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <OrderTableRowView key={order.id} order={order} assumeNetZero={assumeNetZero} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderTableRowView({ order, assumeNetZero }: { order: OrderTableRow; assumeNetZero: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const money = (n: number) => formatMoney(n, order.currency);
  const hasFees = order.feesBreakdown && typeof order.feesBreakdown.totalFees === "number";

  const lines: Array<{ label: string; amount: number }> = [];
  if (hasFees) {
    const b = order.feesBreakdown!;
    const rates = b.ratesUsed;
    if (typeof b.itemTotal === "number") lines.push({ label: "Item total", amount: b.itemTotal });
    if (typeof b.shippingTotal === "number" && b.shippingTotal !== 0)
      lines.push({ label: "Shipping charged", amount: b.shippingTotal });
    if (typeof b.giftWrapTotal === "number" && b.giftWrapTotal !== 0)
      lines.push({ label: "Gift wrap", amount: b.giftWrapTotal });
    if (typeof b.transactionFee === "number")
      lines.push({ label: `Transaction fee (${formatPercent(rates?.transactionFeeRate ?? 0.065)})`, amount: -b.transactionFee });
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
      lines.push({ label: `Offsite Ads fee${rates?.offsiteAdsRate ? ` (${formatPercent(rates.offsiteAdsRate)})` : ""}`, amount: -b.offsiteAdsFee });
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
      lines.push({ label: `VAT on fees${rates?.vatRate ? ` (${formatPercent(rates.vatRate)})` : ""}`, amount: -b.vatOnFees });
  }

  const itemsSummary = order.items.map((i) => (i.quantity > 1 ? `${i.title} ×${i.quantity}` : i.title)).join(", ");

  return (
    <>
      <tr>
        <td style={tdStyle}>{order.orderDate.toLocaleDateString()}</td>
        <td style={tdStyle}>
          {order.items[0] ? (
            <a
              href={`https://www.etsy.com/listing/${order.items[0].etsyListingId}`}
              target="_blank"
              rel="noreferrer noopener"
              style={listingLinkStyle}
            >
              {order.items[0].imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Etsy-hosted
                // thumbnail, not a local/optimizable asset; next/image would need
                // this exact host allow-listed in next.config.js for no real gain.
                <img src={order.items[0].imageUrl} alt="" style={thumbStyle} />
              ) : (
                <div style={thumbPlaceholderStyle} />
              )}
              <div style={{ minWidth: 0 }}>
                <div>#{order.receiptId}</div>
                {/* Truncated with an ellipsis instead of wrapping across
                   several lines (2026-09-23, mobile fix #7) — the full
                   title is still there via title="", for a hover/long-press.
                   See globals.css's ".truncate-title". */}
                {itemsSummary && (
                  <div className="truncate-title" title={itemsSummary} style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    {itemsSummary}
                  </div>
                )}
              </div>
            </a>
          ) : (
            <div>#{order.receiptId}</div>
          )}
        </td>
        <td style={tdNumStyle}>{money(order.grossAmount)}</td>
        <td style={tdNumStyle}>
          {hasFees ? (
            <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} style={expandButtonStyle}>
              <span>{money(order.feesBreakdown!.totalFees!)}</span>
              <span style={{ display: "inline-block", transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▾
              </span>
            </button>
          ) : (
            <span style={{ color: "var(--muted)" }}>pending</span>
          )}
        </td>
        <td style={tdNumStyle}>
          {order.shippingUnknown && !assumeNetZero ? (
            <button onClick={() => setExpanded(true)} style={linkButtonStyle}>
              add cost
            </button>
          ) : assumeNetZero ? (
            <span style={{ color: "var(--muted)" }}>net-zero</span>
          ) : order.shippingCostAtSale !== null ? (
            money(order.shippingCostAtSale)
          ) : (
            <span style={{ color: "var(--muted)" }}>—</span>
          )}
        </td>
        <td style={{ ...tdNumStyle, textAlign: "right" }}>
          {order.shippingUnknown && !assumeNetZero ? (
            <button onClick={() => setExpanded(true)} style={linkButtonStyle}>
              {order.profitLabel}
            </button>
          ) : (
            <span className={order.netProfit !== null ? (order.netProfit >= 0 ? "profit-positive" : "profit-negative") : ""}>
              {order.profitLabel}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ ...tdStyle, background: "var(--surface-2)" }}>
            {/* className carries the maxWidth now (2026-09-23, mobile fix
               #8) — the fixed 420px left empty space to the right of this
               panel once the row was already wide, reading as an extra
               reason for the table's horizontal scroll. See globals.css's
               ".fee-breakdown-panel": full-width below 640px. */}
            <div className="fee-breakdown-panel" style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.85rem" }}>
              {lines.map((line, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted)" }}>{line.label}</span>
                  <span>{line.amount < 0 ? `-${money(-line.amount)}` : money(line.amount)}</span>
                </div>
              ))}
              {hasFees && (
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, borderTop: "1px solid var(--line)", paddingTop: 4 }}>
                  <span>Total fees</span>
                  <span>-{money(order.feesBreakdown!.totalFees!)}</span>
                </div>
              )}
              {typeof order.feesBreakdown?.netToSeller === "number" && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                  <span>Net to seller (before cost of goods)</span>
                  <span>{money(order.feesBreakdown.netToSeller)}</span>
                </div>
              )}
              {typeof order.feesBreakdown?.shippingTotal === "number" && order.feesBreakdown.shippingTotal !== 0 && (
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
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>assumed net-zero — excluded from profit</span>
                  ) : (
                    <ShippingCostEditor
                      orderId={order.id}
                      initialCost={order.shippingCostAtSale}
                      currency={order.currency}
                      singleListingId={order.singleListingId}
                    />
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
