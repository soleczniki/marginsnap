"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol } from "@/lib/money";
import type { CogsMode } from "@/lib/cogs";

export interface CogsEntrySummary {
  id: string;
  cogsAmount: number;
  /** YYYY-MM-DD — server already resolved this to a plain date string for
   * display; see dashboard/listings/page.tsx. */
  effectiveFrom: string;
}

// Cost-of-goods editor for one listing on the "Manage costs" page.
// Rewritten 2026-09-16 (Bogdan's request, Sellerboard-style) from a single
// value into a dated history: setting a new cost picks one of three modes —
//   - "today": takes effect for orders synced from now on only. Can never
//     touch an already-synced order, so it saves immediately, no warning.
//   - "all" / "date": CAN overwrite the cost of goods (and profit) already
//     shown for orders that exist right now. Before either of these
//     actually saves, this fetches exactly how many order line items would
//     be recomputed (GET .../cogs/affected-count) and requires an explicit
//     confirm() naming that count and warning it can't be undone — this is
//     the one action in the app that can genuinely change an
//     already-computed number, not just fill in a gap (contrast with
//     DefaultShippingCostEditor/ShippingCostEditor's backfill, which only
//     ever fills in values that were never set).
// See src/lib/cogs.ts and src/app/api/listings/[id]/cogs/route.ts.
export function CogsEditor({
  listingId,
  currentCogs,
  entries,
  currency,
}: {
  listingId: string;
  /** The cost in effect as of today, resolved server-side from `entries` —
   * null when no entry covers today yet (same "add a cost to see profit"
   * state as before this feature existed). */
  currentCogs: number | null;
  /** Past entries, newest effectiveFrom first — shown as a small collapsible
   * history so a second cost change doesn't look like it erased the first. */
  entries: CogsEntrySummary[];
  currency: string | null;
}) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<CogsMode>("today");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSave() {
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed) || parsed < 0) {
      alert("Enter a cost of 0 or more.");
      return;
    }
    if (mode === "date" && !date) {
      alert("Pick a date for the 'from a specific date' option.");
      return;
    }

    setSaving(true);
    setSavedMessage(null);
    try {
      let confirmed = false;
      if (mode !== "today") {
        const params = new URLSearchParams({ mode });
        if (mode === "date") params.set("date", date);
        const previewRes = await fetch(`/api/listings/${listingId}/cogs/affected-count?${params.toString()}`);
        const previewData = await previewRes.json().catch(() => null);
        if (!previewRes.ok) {
          alert(previewData?.error ?? "Couldn't check how many orders this would affect — try again in a moment.");
          return;
        }
        const count: number = previewData?.count ?? 0;
        if (count > 0) {
          confirmed = window.confirm(
            `This will overwrite the cost of goods for ${count} order${count === 1 ? "" : "s"} that ` +
              `${count === 1 ? "is" : "are"} already synced. Do you really want to proceed? This change can't be undone.`
          );
          if (!confirmed) return;
        } else {
          confirmed = true; // nothing to overwrite — no orders match yet, no need to ask
        }
      }

      const res = await fetch(`/api/listings/${listingId}/cogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cogsAmount: parsed, mode, date: mode === "date" ? date : undefined, confirmed }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const recomputed: number = data?.recomputedCount ?? 0;
        setSavedMessage(recomputed > 0 ? `Saved — updated ${recomputed} order${recomputed === 1 ? "" : "s"}` : "Saved");
        setValue("");
        setMode("today");
        setDate("");
        router.refresh();
      } else {
        alert(data?.error ?? "Couldn't save that cost — try again in a moment.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          Current: {currentCogs !== null ? `${currencySymbol(currency)}${currentCogs.toFixed(2)}` : "not set"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "var(--muted)" }}>{currencySymbol(currency)}</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          style={{
            width: 90,
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--surface-2)",
            color: "var(--ink)",
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input type="radio" name={`cogs-mode-${listingId}`} checked={mode === "today"} onChange={() => setMode("today")} />
          From today
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input type="radio" name={`cogs-mode-${listingId}`} checked={mode === "all"} onChange={() => setMode("all")} />
          Retroactively, all orders
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input type="radio" name={`cogs-mode-${listingId}`} checked={mode === "date"} onChange={() => setMode("date")} />
          From a date
        </label>
        {mode === "date" && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--ink)",
            }}
          />
        )}
        <button type="button" className="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {savedMessage && (
          <span style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem" }}>{savedMessage}</span>
        )}
      </div>

      {entries.length > 0 && (
        <details>
          <summary style={{ color: "var(--muted)", fontSize: "0.8rem", cursor: "pointer" }}>
            Cost history ({entries.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6, fontSize: "0.8rem", color: "var(--muted)" }}>
            {entries.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, maxWidth: 260 }}>
                <span>from {e.effectiveFrom}</span>
                <span>
                  {currencySymbol(currency)}
                  {e.cogsAmount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
