"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// One checkbox: "I have a valid EU VAT ID on file with Etsy." This is the
// single fee-engine input (feeEngine.ts) that Etsy's API has no field for —
// everything else (sellerCountry) syncs automatically. See src/lib/sync.ts
// and src/app/api/shop/settings/route.ts.
export function VatIdToggle({ initialValue }: { initialValue: boolean }) {
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
        body: JSON.stringify({ sellerHasValidVatId: next }),
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
        id="vat-id-toggle"
        checked={checked}
        disabled={saving}
        onChange={(e) => handleChange(e.target.checked)}
        style={{ width: 18, height: 18 }}
      />
      <label htmlFor="vat-id-toggle">I have a valid EU VAT ID on file with Etsy</label>
      {savedAt && !saving && <span style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem" }}>Saved</span>}
    </div>
  );
}
