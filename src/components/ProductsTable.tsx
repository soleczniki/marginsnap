import { formatMoney } from "@/lib/money";
import type { ProductAggregate } from "@/lib/profitability";

// The per-product profitability view (Phase 2 of PROJECT.md's roadmap) —
// "which products are actually worth making," for the selected period.
// Fees shown here are MarginSnap's own proportional allocation of each
// order's total fees (Etsy doesn't bill fees per line item) — see
// profitability.ts's aggregateByListing for exactly how that's split.
// No client-side interactivity needed for v1, so this stays a plain
// server-rendered component.
export function ProductsTable({ products }: { products: ProductAggregate[] }) {
  if (products.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No products sold in this period yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {products.map((p) => {
        const money = (n: number) => formatMoney(n, p.currency);
        let profitLabel: string;
        if (p.netProfit !== null) profitLabel = `${p.netProfit >= 0 ? "+" : ""}${money(p.netProfit)}`;
        else if (p.allocatedFees === null) profitLabel = "fees pending";
        else if (p.shippingUnknown) profitLabel = "add shipping cost to see profit";
        else profitLabel = "add cost to see profit";

        return (
          <div key={p.listingId} className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{p.title}</span>
              <span
                className={p.netProfit !== null ? (p.netProfit >= 0 ? "profit-positive" : "profit-negative") : ""}
              >
                {profitLabel}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--muted)" }}>
              <span>
                {p.unitsSold} unit{p.unitsSold === 1 ? "" : "s"} sold
              </span>
              <span>revenue: {money(p.grossRevenue)}</span>
              {p.allocatedFees !== null && <span>fees: {money(p.allocatedFees)}</span>}
              {p.allocatedShipping !== null && p.allocatedShipping !== 0 && (
                <span>shipping cost: {money(p.allocatedShipping)}</span>
              )}
              {p.cogsTotal !== null && <span>cost: {money(p.cogsTotal)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
