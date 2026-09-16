"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol } from "@/lib/money";

// Inline postage-cost editor for one order row — mirrors CogsEditor.tsx's
// pattern exactly, but per-order (postage cost varies order to order,
// unlike a listing's cost-of-goods). Only rendered by OrderRow when the
// shop is in real-cost shipping mode and this order actually charged for
// shipping — see OrderRow.tsx and src/lib/profitability.ts.
export function ShippingCostEditor({
  orderId,
  initialCost,
  currency,
}: {
  orderId: string;
  initialCost: number | null;
  /** The order's real currency, so the input's prefix matches the €/£/$
   * shown everywhere else on this order rather than assuming dollars. */
  currency: string | null;
}) {
  const [value, setValue] = useState(initialCost !== null ? String(initialCost) : "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const router = useRouter();

  async function handleSave() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      alert("Enter a cost of 0 or more, or leave it blank to clear it.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/shipping-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingCostAtSale: parsed }),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        router.refresh();
      } else {
        alert("Couldn't save that cost — try again in a moment.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
      <button type="button" className="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {savedAt && !saving && <span style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem" }}>Saved</span>}
    </div>
  );
}
