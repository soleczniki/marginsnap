"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shop connection controls on /dashboard/settings (2026-10-22, Bogdan's
// request: settings must always offer a way to disconnect and reconnect, with
// a warning that disconnecting deletes everything). Replaces the old
// single-purpose ReconnectShopLink.
//
// - Reconnect: sends the seller back through Etsy's consent screen. The
//   callback (src/app/api/etsy/callback/route.ts) keeps all data when the
//   same Etsy shop comes back, and only replaces it when a different shop is
//   authorized - so the warning covers that one case.
// - Disconnect: deletes the shop and, via cascade, its listings, orders,
//   costs and ad spend. Permanent, so it sits behind an explicit confirm.
export function ShopConnectionActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleReconnect(e: React.MouseEvent<HTMLAnchorElement>) {
    const ok = window.confirm(
      "Reconnect with Etsy? If you sign in with the same Etsy shop, everything is kept (orders, costs, ad spend). If you sign in with a different shop, all data for the shop connected now is permanently deleted - there's no undo. Continue to Etsy?"
    );
    if (!ok) e.preventDefault();
  }

  async function handleDisconnect() {
    const ok = window.confirm(
      "Disconnect this shop? This permanently deletes every synced order and listing, plus all the costs and ad spend you entered - there's no undo. You can connect a shop again afterwards, but it will start from scratch."
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("disconnect failed");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't disconnect the shop. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
      <a href="/api/etsy/connect" onClick={handleReconnect} className="button">
        Reconnect Etsy
      </a>
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={busy}
        className="button"
        style={{
          background: "none",
          color: "var(--loss)",
          border: "1px solid var(--loss)",
          padding: "9px 17px", // 1px less than .button on each side, to make room for the border and keep both buttons the same height
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Disconnecting…" : "Disconnect shop and delete data"}
      </button>
      {error && <span style={{ color: "var(--loss)", fontSize: "0.85rem" }}>{error}</span>}
    </div>
  );
}
