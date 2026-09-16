import type { PeriodKey } from "@/lib/periods";
import type { ViewKey } from "@/components/DashboardTabs";

// View-only quick toggle for how THIS dashboard load treats shipping in
// profit math — "count" (real postage cost — the default unless the shop's
// own setting says otherwise) vs "exclude" (net-zero, same assumption as
// the shop-level toggle on /dashboard/settings). Plain links with a
// ?shipping= query param, same pattern as PeriodPicker — never writes
// anything, so switching it back just re-renders using the shop's stored
// default again. Also preserves ?view= (the Orders/Products tab,
// DashboardTabs.tsx) and, when the current period is "custom", its
// ?start=/?end= — otherwise switching shipping mode while looking at a
// custom range would silently snap back to a fixed preset. See
// dashboard/page.tsx and profitability.ts's file header.
export function ShippingModeToggle({
  active,
  period,
  view,
  start,
  end,
}: {
  active: "count" | "exclude";
  period: PeriodKey;
  view?: ViewKey;
  start?: string;
  end?: string;
}) {
  const options: Array<{ key: "count" | "exclude"; label: string }> = [
    { key: "count", label: "Count shipping cost" },
    { key: "exclude", label: "Exclude shipping (net-zero)" },
  ];

  function hrefFor(shipping: "count" | "exclude"): string {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("shipping", shipping);
    if (view) params.set("view", view);
    if (period === "custom" && start) params.set("start", start);
    if (period === "custom" && end) params.set("end", end);
    return `/dashboard?${params.toString()}`;
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <a
          key={o.key}
          href={hrefFor(o.key)}
          className="button"
          style={{
            fontSize: "0.8rem",
            background: o.key === active ? "var(--ink)" : "transparent",
            color: o.key === active ? "var(--paper)" : "inherit",
            border: o.key === active ? "none" : "1px solid var(--line)",
          }}
        >
          {o.label}
        </a>
      ))}
    </div>
  );
}
