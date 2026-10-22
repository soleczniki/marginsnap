"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Manual sync trigger on the dashboard - POSTs to /api/etsy/sync, then
// refreshes the server-rendered page so the new data (and updated
// "Last synced" time) show up without a full reload. A failed sync (for
// example a dead Etsy connection) used to fail silently, leaving an old
// "Last synced" date with no explanation (2026-10-22) - now it says so and
// points at the reconnect controls in Settings.
export function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    setFailed(false);
    try {
      const res = await fetch("/api/etsy/sync", { method: "POST" });
      if (!res.ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setSyncing(false);
      router.refresh();
    }
  }

  return (
    <>
      <button type="button" className="button" onClick={handleSync} disabled={syncing}>
        {syncing ? "Syncing…" : "Sync now"}
      </button>
      {failed && (
        <p style={{ color: "var(--loss)", fontSize: "0.8rem", textAlign: "right", margin: 0 }}>
          Sync failed. If it keeps failing,{" "}
          <a href="/dashboard/settings#shop-connection" style={{ color: "var(--loss)", textDecoration: "underline" }}>
            reconnect your shop
          </a>
          .
        </p>
      )}
    </>
  );
}
