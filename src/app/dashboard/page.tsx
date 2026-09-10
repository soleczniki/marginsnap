import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SyncButton } from "@/components/SyncButton";

// V1 of the dashboard (Blueprint workflow §4). Deliberately minimal —
// per-listing COGS entry (workflow §2) and CSV export are Phase 3 work, not
// this scaffold. The point here is: does a connected shop's real data render
// correctly end to end, with an honest "has this actually synced yet" state
// instead of a static "syncing…" that never changes.
export default async function Dashboard({
  searchParams,
}: {
  searchParams: { connected?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const [shop, user] = await Promise.all([
    prisma.shop.findFirst({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  // "active" or "trialing" are the only statuses that mean "currently paying" —
  // everything else (past_due, canceled, or never subscribed) shows "Upgrade."
  const isSubscribed = user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing";

  const header = (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid var(--line)",
        marginBottom: 24,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontWeight: 700 }}>MarginSnap</span>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a
          href={isSubscribed ? "/api/stripe/portal" : "/api/stripe/checkout"}
          style={{ fontSize: "0.85rem", color: "var(--muted)" }}
        >
          {isSubscribed ? "Manage billing" : "Upgrade (currently free)"}
        </a>
        <a href="/api/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Sign out
        </a>
      </div>
    </header>
  );

  if (!shop) {
    return (
      <>
        {header}
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px" }}>
          <h1 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Connect your Etsy shop</h1>
          <p style={{ color: "var(--muted)", marginBottom: 24 }}>
            MarginSnap reads your listings and orders directly from Etsy — nothing to set up
            manually.
          </p>
          <a href="/api/etsy/connect" className="button">
            Connect Etsy shop
          </a>
        </main>
      </>
    );
  }

  const [orders, listings] = await Promise.all([
    prisma.order.findMany({
      where: { shopId: shop.id },
      orderBy: { orderDate: "desc" },
      take: 20,
      include: { lineItems: true },
    }),
    prisma.listing.findMany({ where: { shopId: shop.id } }),
  ]);

  const listingsMissingCogs = listings.filter((l) => l.cogsAmount === null).length;

  return (
    <>
      {header}
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
        {searchParams.connected === "1" && (
          <div className="card" style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
            ✅ Etsy shop connected — pulling your listings and orders now.
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>{shop.shopName ?? "Your shop"}</h1>
            <p style={{ color: "var(--muted)" }}>
              {shop.lastSyncedAt
                ? `Last synced: ${shop.lastSyncedAt.toLocaleString()}`
                : "Not synced yet — click Sync now, or wait for the daily automatic sync."}
            </p>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>
              {listings.length} listing{listings.length === 1 ? "" : "s"} synced
            </p>
          </div>
          <SyncButton />
        </div>

        {listings.length > 0 && (
          <div className="card" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <span>
              {listingsMissingCogs > 0
                ? `${listingsMissingCogs} listing${listingsMissingCogs === 1 ? "" : "s"} still need a cost set before their profit shows.`
                : "All your listings have a cost set."}
            </span>
            <a href="/dashboard/listings" className="button">
              Manage costs
            </a>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: "1.05rem" }}>Recent orders</h2>
          {orders.length > 0 && (
            <a href="/api/export/csv" className="button" style={{ fontSize: "0.85rem" }}>
              Export CSV
            </a>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {orders.length === 0 && <p style={{ color: "var(--muted)" }}>No orders synced yet.</p>}
          {orders.map((order) => {
            const profits = order.lineItems.map((li) => li.lineProfit);
            const knownProfit = profits.length > 0 && profits.every((p) => p !== null);
            const total = knownProfit ? profits.reduce((sum, p) => sum + Number(p), 0) : null;
            return (
              <div
                key={order.id}
                className="card"
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>{order.orderDate.toLocaleDateString()}</span>
                <span>${Number(order.grossAmount).toFixed(2)}</span>
                <span className={total !== null ? (total >= 0 ? "profit-positive" : "profit-negative") : ""}>
                  {total !== null ? `${total >= 0 ? "+" : ""}$${total.toFixed(2)}` : "add cost to see profit"}
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
