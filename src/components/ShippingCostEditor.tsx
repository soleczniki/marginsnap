"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol } from "@/lib/money";

// Inline postage-cost editor for one order row — mirrors CogsEditor.tsx's
// pattern exactly, but per-order (postage cost varies order to order,
// unlike a listing's cost-of-goods). Only rendered by OrderRow when the
// shop is in real-cost shipping mode and this order actually charged for
// shipping — see OrderRow.tsx and src/lib/profitability.ts.
//
// "Save and apply to all orders without shipping cost" (2026-09-16 request)
// is the same backfill DefaultShippingCostEditor's action on the Manage
// Costs page does, just triggered from here instead: save this order's
// cost, then set it as this listing's default and backfill every other
// order of that listing that has no shipping cost entered yet. Only shown
// when singleListingId is set — i.e. this order is a single-listing order,
// the same safety rule the backfill route itself enforces (a multi-product
// order is never a safe source for one listing's "typical" cost).
export function ShippingCostEditor({
  orderId,
  initialCost,
  currency,
  singleListingId,
}: {
  orderId: string;
  initialCost: number | null;
  /** The order's real currency, so the input's prefix matches the €/£/$
   * shown everywhere else on this order rather than assuming dollars. */
  currency: string | null;
  /** The one listing this order is for, or null when the order has more
   * than one distinct listing (see dashboard/page.tsx's toDayOrder). */
  singleListingId: string | null;
}) {
  const [value, setValue] = useState(initialCost !== null ? String(initialCost) : "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyAllResult, setApplyAllResult] = useState<string | null>(null);
  const router = useRouter();

  function parseValue(): number | null | undefined {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      alert("Enter a cost of 0 or more, or leave it blank to clear it.");
      return undefined;
    }
    return parsed;
  }

  async function saveThisOrder(parsed: number | null): Promise<boolean> {
    const res = await fetch(`/api/orders/${orderId}/shipping-cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingCostAtSale: parsed }),
    });
    return res.ok;
  }

  async function handleSave() {
    const parsed = parseValue();
    if (parsed === undefined) return;
    setSaving(true);
    try {
      if (await saveThisOrder(parsed)) {
        setSavedAt(Date.now());
        router.refresh();
      } else {
        alert("Couldn't save that cost — try again in a moment.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndApply() {
    if (!singleListingId) return;
    const parsed = parseValue();
    if (parsed === undefined) return;
    if (parsed === null) {
      alert("Enter a cost to apply it to other orders — leave it blank only to clear this order's own cost.");
      return;
    }
    setApplyingAll(true);
    setApplyAllResult(null);
    try {
      if (!(await saveThisOrder(parsed))) {
        alert("Couldn't save that cost — try again in a moment.");
        return;
      }
      const defaultRes = await fetch(`/api/listings/${singleListingId}/shipping-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultShippingCost: parsed }),
      });
      if (!defaultRes.ok) {
        alert("Saved this order, but couldn't set it as the listing's default — try again in a moment.");
        router.refresh();
        return;
      }
      const applyRes = await fetch(`/api/listings/${singleListingId}/apply-default-shipping-cost`, {
        method: "POST",
      });
      const applyData = await applyRes.json().catch(() => null);
      if (applyRes.ok) {
        const count = applyData?.updatedCount ?? 0;
        setApplyAllResult(count === 0 ? "No other orders needed it" : `Applied to ${count} other order${count === 1 ? "" : "s"}`);
        setSavedAt(Date.now());
        router.refresh();
      } else {
        alert(applyData?.error ?? "Saved this order, but couldn't apply it to the others — try again in a moment.");
        router.refresh();
      }
    } finally {
      setApplyingAll(false);
    }
  }

  return (
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
      <button type="button" className="button" onClick={handleSave} disabled={saving || applyingAll}>
        {saving ? "Saving…" : "Save"}
      </button>
      {savedAt && !saving && !applyingAll && (
        <span style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem" }}>Saved</span>
      )}
      {singleListingId && (
        <button
          type="button"
          onClick={handleSaveAndApply}
          disabled={saving || applyingAll}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--muted)",
            textDecoration: "underline",
            cursor: "pointer",
            font: "inherit",
            fontSize: "0.8rem",
          }}
        >
          {applyingAll ? "Saving & applying…" : "Save and apply to all orders without shipping cost"}
        </button>
      )}
      {applyAllResult && !applyingAll && (
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{applyAllResult}</span>
      )}
    </div>
  );
}
