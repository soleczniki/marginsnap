"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Manual sync trigger on the dashboard — POSTs to /api/etsy/sync, then
// refreshes the server-rendered page so the new data (and updated
// "Last synced" time) show up without a full reload.
export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/etsy/sync", { method: "POST" });
    } finally {
      setSyncing(false);
      router.refresh();
    }
  }

  return (
    <button type="button" className="button" onClick={handleSync} disabled={syncing}>
      {syncing ? "Syncing…" : "Sync now"}
    </button>
  );
}
