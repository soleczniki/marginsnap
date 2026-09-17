"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";

export interface RecentAdSpendEntry {
  id: string;
  listingTitle: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  amountSpent: number;
  currency: string | null;
}

// "Recently added" list on the ad-spend page, split out as its own client
// component (2026-09-17) so it can offer a delete button — needed once a
// seller can end up with two entries that legitimately overlap (a week,
// then later a month that already includes it) and profitability.ts sums
// both for any dashboard view spanning both. This is where they clean that
// up after the fact; AdSpendImporter's own overlap warning is the same
// action offered before the fact, at import time.
export function RecentAdSpendEntries({
  entries,
  fallbackCurrency,
}: {
  entries: RecentAdSpendEntry[];
  fallbackCurrency: string | null;
}) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Delete this ad spend entry? This can't be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/ad-spend/${id}`, { method: "DELETE" });
      if (!res.ok) {
        alert("couldn't delete that entry — try again");
        return;
      }
      setDeletedIds((prev) => new Set(prev).add(id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const visible = entries.filter((e) => !deletedIds.has(e.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Recently added</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((entry) => (
          <div
            key={entry.id}
            className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 12px", fontSize: "0.85rem" }}
          >
            <span>{entry.listingTitle}</span>
            <span style={{ color: "var(--muted)" }}>
              {entry.periodStart} → {entry.periodEnd}
            </span>
            <span>{formatMoney(entry.amountSpent, entry.currency ?? fallbackCurrency)}</span>
            <button
              type="button"
              onClick={() => handleDelete(entry.id)}
              disabled={deletingId === entry.id}
              style={{ color: "var(--loss)", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem" }}
            >
              {deletingId === entry.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
