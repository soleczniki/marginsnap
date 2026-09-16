import type { ViewKey } from "@/components/DashboardTabs";

// "Custom dates" trigger next to the fixed period-picker buttons (2026-09-16
// request) — opens two native date inputs and applies them as
// ?period=custom&start=YYYY-MM-DD&end=YYYY-MM-DD on submit. A plain
// <details>/<summary> disclosure + a GET <form>, so this needs no client
// JS at all — same philosophy as PeriodPicker/ShippingModeToggle staying
// link-only. dashboard/page.tsx validates start/end (falls back to the 30-day
// default if either is missing or unparsable) and computes periodRange's
// "custom" case from them — see src/lib/periods.ts.
export function CustomDatePicker({
  active,
  start,
  end,
  shipping,
  view,
}: {
  /** True when ?period=custom is the currently-applied range — keeps the
   * disclosure open and highlights the trigger like an active PeriodPicker
   * button. */
  active: boolean;
  /** YYYY-MM-DD strings to prefill the inputs with — the exact custom range
   * in effect, or (when a fixed preset is active) that preset's own
   * start/end, so opening this always starts from what's on screen. */
  start?: string;
  end?: string;
  shipping?: "count" | "exclude";
  view?: ViewKey;
}) {
  return (
    <details open={active} style={{ display: "inline-block" }}>
      <summary
        className="button"
        style={{
          fontSize: "0.85rem",
          cursor: "pointer",
          display: "inline-block",
          background: active ? "var(--ink)" : "transparent",
          color: active ? "var(--paper)" : "inherit",
          border: active ? "none" : "1px solid var(--line)",
        }}
      >
        Custom dates
      </summary>
      <form
        method="get"
        action="/dashboard"
        style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}
      >
        <input type="hidden" name="period" value="custom" />
        {shipping && <input type="hidden" name="shipping" value={shipping} />}
        {view && <input type="hidden" name="view" value={view} />}
        <input
          type="date"
          name="start"
          defaultValue={start}
          required
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--ink)",
          }}
        />
        <span style={{ color: "var(--muted)" }}>to</span>
        <input
          type="date"
          name="end"
          defaultValue={end}
          required
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--ink)",
          }}
        />
        <button type="submit" className="button" style={{ fontSize: "0.85rem" }}>
          Apply
        </button>
      </form>
    </details>
  );
}
