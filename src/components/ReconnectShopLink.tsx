"use client";

// "Reconnect a different shop" (2026-09-17, Bogdan's request). The actual
// swap logic already existed — src/app/api/etsy/callback/route.ts deletes
// whatever shop is currently connected (cascading to its listings, orders,
// and cost history) and creates a fresh one from whatever Etsy account
// completes the OAuth flow — but nothing in the UI pointed at it once a
// shop was already connected; a seller would've had to know to visit
// /api/etsy/connect directly. This is just that missing entry point, with
// a confirm() in front of it since the delete is real and permanent —
// same "make sure they meant it" pattern CogsEditor.tsx uses before a
// retroactive cost change, just for a bigger, one-way action.
export function ReconnectShopLink() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const ok = window.confirm(
      "This permanently deletes every synced order, listing, and cost you've entered for the shop currently connected here — there's no undo. Continue to Etsy to connect a different shop?"
    );
    if (!ok) e.preventDefault();
  }

  return (
    <a href="/api/etsy/connect" onClick={handleClick} style={{ color: "var(--loss)", fontWeight: 600 }}>
      Reconnect a different Etsy shop
    </a>
  );
}
