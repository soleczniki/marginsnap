import { PERIODS, type PeriodKey } from "@/lib/periods";
import type { ViewKey } from "@/components/DashboardTabs";

// Plain links with a ?period= query param — no client JS needed, the
// server component re-renders with the new range on navigation. Preserves
// ?shipping= (ShippingModeToggle's view-only override) and ?view= (the
// Orders/Products tab, DashboardTabs.tsx) across period switches, so picking
// a new period doesn't silently reset either of those back to their default.
export function PeriodPicker({
  active,
  shipping,
  view,
}: {
  active: PeriodKey;
  shipping?: "count" | "exclude";
  view?: ViewKey;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {PERIODS.map((p) => (
        <a
          key={p.key}
          href={`/dashboard?period=${p.key}${shipping ? `&shipping=${shipping}` : ""}${view ? `&view=${view}` : ""}`}
          className="button"
          style={{
            fontSize: "0.85rem",
            background: p.key === active ? "var(--ink)" : "transparent",
            color: p.key === active ? "var(--paper)" : "inherit",
            border: p.key === active ? "none" : "1px solid var(--line)",
          }}
        >
          {p.label}
        </a>
      ))}
    </div>
  );
}
