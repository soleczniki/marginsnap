import { PERIODS, type PeriodKey } from "@/lib/periods";

// Plain links with a ?period= query param — no client JS needed, the
// server component re-renders with the new range on navigation. Preserves
// ?shipping= (ShippingModeToggle's view-only override) across period
// switches, so picking a new period doesn't silently reset it back to the
// shop's stored default.
export function PeriodPicker({ active, shipping }: { active: PeriodKey; shipping?: "count" | "exclude" }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {PERIODS.map((p) => (
        <a
          key={p.key}
          href={`/dashboard?period=${p.key}${shipping ? `&shipping=${shipping}` : ""}`}
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
