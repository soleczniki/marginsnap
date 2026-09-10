"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Inline cost-of-goods editor for one listing row on the "Manage costs" page.
// Saving only affects future syncs' profit math, never past orders — see the
// note in src/app/api/listings/[id]/cogs/route.ts.
export function CogsEditor({ listingId, initialCogs }: { listingId: string; initialCogs: number | null }) {
  const [value, setValue] = useState(initialCogs !== null ? String(initialCogs) : "");
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
      const res = await fetch(`/api/listings/${listingId}/cogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cogsAmount: parsed }),
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
      <span style={{ color: "var(--muted)" }}>$</span>
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
