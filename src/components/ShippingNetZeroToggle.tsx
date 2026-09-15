"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// One checkbox: "I charge buyers the same amount I pay for shipping." Sets
// the shop-level default for how shipping is treated in profit math
// (src/lib/profitability.ts) — the dashboard also has a view-only quick
// toggle (ShippingModeToggle) that previews the other mode without
// changing this stored default. See src/app/api/shop/settings/route.ts.
export function ShippingNetZeroToggle({ initialValue }: { initialValue: boolean }) {
  const [checked, setChecked] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const router = useRouter();

  async function handleChange(next: boolean) {
    setChecked(next);
    setSaving(true);
    try {
      const res = await fetch("/api/shop/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumeShippingNetZero: next }),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        router.refresh();
      } else {
        alert("Couldn't save that — try again in a moment.");
        setChecked(!next); // revert the optimistic toggle
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        type="checkbox"
        id="shipping-net-zero-toggle"
        checked={checked}
        disabled={saving}
        onChange={(e) => handleChange(e.target.checked)}
        style={{ width: 18, height: 18 }}
      />
      <label htmlFor="shipping-net-zero-toggle">I charge buyers the same amount I pay for shipping</label>
      {savedAt && !saving && <span style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem" }}>Saved</span>}
    </div>
  );
}
