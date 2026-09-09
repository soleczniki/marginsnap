import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// V0 of the dashboard (Blueprint workflow §4). Deliberately minimal —
// per-listing COGS entry (workflow §2) and CSV export are Phase 3 work, not
// this scaffold. The point here is: does a connected shop's real data render
// correctly end to end, once Phase 2's sync is wired up.
export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });

  if (!shop) {
    return (
      <main style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Connect your Etsy shop</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          MarginSnap reads your listings and orders directly from Etsy — nothing to set up
          manually.
        </p>
        <a href="/api/etsy/connect" className="button">
          Connect Etsy shop
        </a>
      </main>
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
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>{shop.shopName ?? "Your shop"}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Last synced: {shop.lastSyncedAt ? shop.lastSyncedAt.toLocaleString() : "syncing…"}
      </p>

      {listingsMissingCogs > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
          {listingsMissingCogs} listing{listingsMissingCogs === 1 ? "" : "s"} still need a cost
          set before their profit shows — that entry screen is next up (Roadmap Phase 3).
        </div>
      )}

      <h2 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Recent orders</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {orders.length === 0 && (
          <p style={{ color: "var(--muted)" }}>No orders synced yet.</p>
        )}
        {orders.map((order) => {
          const profits = order.lineItems.map((li) => li.lineProfit);
          const knownProfit = profits.every((p) => p !== null);
          const total = knownProfit
            ? profits.reduce((sum, p) => sum + Number(p), 0)
            : null;
          return (
            <div key={order.id} className="card" style={{ display: "flex", justifyContent: "space-between" }}>
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
  );
}
