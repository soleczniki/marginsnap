import type { CSSProperties } from "react";
import { formatMoney } from "@/lib/money";
import type { ProductAggregate } from "@/lib/profitability";

const thStyle: CSSProperties = { padding: "8px 10px", color: "var(--muted)", fontWeight: 600, fontSize: "0.8rem", textAlign: "left" };
const tdStyle: CSSProperties = { padding: "10px", borderBottom: "1px solid var(--line)", verticalAlign: "top" };

// The per-product profitability view (Phase 2 of PROJECT.md's roadmap),
// redesigned 2026-09-17 (Bogdan's Sellerboard-style request) from a card
// per product into a real table with headers — Product / Units / Revenue /
// Fees / Shipping / Cost / Profit. The numbers themselves are unchanged:
// fees and shipping here are still MarginSnap's own proportional allocation
// of each order's totals (Etsy doesn't bill fees per line item) — see
// profitability.ts's aggregateByListing for exactly how that's split, and
// note it already reconciles with the order-level numbers, so there's no
// separate "make per-product profit add up" fix needed here. Read-only for
// now (no inline cost editing) — that still lives on the Manage Costs page.
//
// Ad spend column (2026-09-17): unlike the other three cost columns, "—"
// here means "not tracked for this period," not "zero fees/cost" — see
// ProductAggregate.adSpendTotal's comment in profitability.ts. Entering it
// lives on a separate page (/dashboard/ad-spend), not inline here.
export function ProductsTable({ products }: { products: ProductAggregate[] }) {
  if (products.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No products sold in this period yet.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--line)" }}>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>Units</th>
            <th style={thStyle}>Revenue</th>
            <th style={thStyle}>Fees</th>
            <th style={thStyle}>Shipping</th>
            <th style={thStyle}>Cost</th>
            <th style={thStyle}>Ad spend</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Profit</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const money = (n: number) => formatMoney(n, p.currency);
            let profitLabel: string;
            if (p.netProfit !== null) profitLabel = `${p.netProfit >= 0 ? "+" : ""}${money(p.netProfit)}`;
            else if (p.allocatedFees === null) profitLabel = "fees pending";
            else if (p.shippingUnknown) profitLabel = "add shipping cost";
            else profitLabel = "add cost";

            return (
              <tr key={p.listingId}>
                <td style={tdStyle}>{p.title}</td>
                <td style={tdStyle}>{p.unitsSold}</td>
                <td style={tdStyle}>{money(p.grossRevenue)}</td>
                <td style={tdStyle}>
                  {p.allocatedFees !== null ? money(p.allocatedFees) : <span style={{ color: "var(--muted)" }}>pending</span>}
                </td>
                <td style={tdStyle}>
                  {p.allocatedShipping !== null ? money(p.allocatedShipping) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                <td style={tdStyle}>
                  {p.cogsTotal !== null ? money(p.cogsTotal) : <span style={{ color: "var(--muted)" }}>—</span>}
                </td>
                <td style={tdStyle}>
                  {p.adSpendTotal > 0 ? (
                    money(p.adSpendTotal)
                  ) : (
                    <span style={{ color: "var(--muted)" }} title="Not tracked yet for this period — see Ad spend">
                      —
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <span className={p.netProfit !== null ? (p.netProfit >= 0 ? "profit-positive" : "profit-negative") : ""}>
                    {profitLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
