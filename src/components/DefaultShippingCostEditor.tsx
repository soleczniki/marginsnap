"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol } from "@/lib/money";

// Sets a listing's "typical shipping cost" — mirrors CogsEditor.tsx's
// input+Save pattern, plus a second "Apply to existing orders" button that
// backfills any of this listing's past orders that don't have a real
// shipping cost yet (never overwrites one that's already set). See
// src/app/api/listings/[id]/shipping-cost and .../apply-default-shipping-cost.
export function DefaultShippingCostEditor({
  listingId,
  initialCost,
  currency,
}: {
  listingId: string;
  initialCost: number | null;
  currency: string | null;
}) {
  const [value, setValue] = useState(initialCost !== null ? String(initialCost) : "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<number | null>(null);
  const router = useRouter();

  async function handleSave() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      alert("Enter a cost of 0 or more, or leave it blank to clear it.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/shipping-cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultShippingCost: parsed }),
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

  async function handleApply() {
    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/apply-default-shipping-cost`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setApplyResult(data?.updatedCount ?? 0);
        router.refresh();
      } else {
        alert(data?.error ?? "Couldn't apply that — try again in a moment.");
      }
    } finally {
      setApplying(false);
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
      <button type="button" className="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      {savedAt && !saving && <span style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem" }}>Saved</span>}
      <button
        type="button"
        className="button"
        onClick={handleApply}
        disabled={applying || initialCost === null}
        title={initialCost === null ? "Save a default shipping cost first" : undefined}
        style={{ fontSize: "0.8rem" }}
      >
        {applying ? "Applying…" : "Apply to existing orders"}
      </button>
      {applyResult !== null && !applying && (
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {applyResult === 0 ? "No orders needed it" : `Applied to ${applyResult} order${applyResult === 1 ? "" : "s"}`}
        </span>
      )}
    </div>
  );
}
