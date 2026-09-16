import type { PeriodKey } from "@/lib/periods";

export type ViewKey = "orders" | "products";

// Tabs above the dashboard content, switching between the Orders list and
// the Products table (2026-09-16 request) instead of always stacking both —
// Orders grows without bound over time, so Products was always getting
// pushed further down the page the more orders came in. Plain links, same
// ?param pattern as PeriodPicker/ShippingModeToggle, so switching tabs never
// touches anything server-side — it preserves whatever period/shipping
// mode/custom date range is currently selected.
export function DashboardTabs({
  active,
  period,
  shipping,
  start,
  end,
}: {
  active: ViewKey;
  period: PeriodKey;
  shipping?: "count" | "exclude";
  /** Only meaningful (and only included in the tab links) when period is
   * "custom" — see CustomDatePicker.tsx. */
  start?: string;
  end?: string;
}) {
  const tabs: Array<{ key: ViewKey; label: string }> = [
    { key: "orders", label: "Orders" },
    { key: "products", label: "Products" },
  ];

  function hrefFor(view: ViewKey): string {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("view", view);
    if (shipping) params.set("shipping", shipping);
    if (period === "custom" && start) params.set("start", start);
    if (period === "custom" && end) params.set("end", end);
    return `/dashboard?${params.toString()}`;
  }

  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 20 }}>
      {tabs.map((t) => (
        <a
          key={t.key}
          href={hrefFor(t.key)}
          style={{
            padding: "10px 16px",
            fontSize: "0.95rem",
            fontWeight: t.key === active ? 600 : 400,
            color: t.key === active ? "var(--ink)" : "var(--muted)",
            borderBottom: t.key === active ? "2px solid var(--ink)" : "2px solid transparent",
            textDecoration: "none",
          }}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}
