import type { PeriodKey } from "@/lib/periods";

// View-only quick toggle for how THIS dashboard load treats shipping in
// profit math — "count" (real postage cost — the default unless the shop's
// own setting says otherwise) vs "exclude" (net-zero, same assumption as
// the shop-level toggle on /dashboard/settings). Plain links with a
// ?shipping= query param, same pattern as PeriodPicker — never writes
// anything, so switching it back just re-renders using the shop's stored
// default again. See dashboard/page.tsx and profitability.ts's file header.
export function ShippingModeToggle({
  active,
  period,
}: {
  active: "count" | "exclude";
  period: PeriodKey;
}) {
  const options: Array<{ key: "count" | "exclude"; label: string }> = [
    { key: "count", label: "Count shipping cost" },
    { key: "exclude", label: "Exclude shipping (net-zero)" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map((o) => (
        <a
          key={o.key}
          href={`/dashboard?period=${period}&shipping=${o.key}`}
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
