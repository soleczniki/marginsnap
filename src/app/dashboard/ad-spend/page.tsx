import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdSpendImporter } from "@/components/AdSpendImporter";
import { getBillingStatus } from "@/lib/billing";
import { TrialEndedScreen } from "@/components/TrialEndedScreen";
import { formatMoney } from "@/lib/money";

// Ad spend (2026-09-17, Bogdan's request) — separate from "Manage costs"
// since it isn't a per-listing constant the way COGS/shipping are, it's a
// dated report the seller brings in periodically. See schema.prisma's
// AdSpendEntry comment for why this exists as a manual import rather than
// an Etsy API pull, and src/lib/profitability.ts for how these entries
// reduce a listing's profit for whichever dashboard period they overlap.
export default async function AdSpend() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const [shop, user] = await Promise.all([
    prisma.shop.findFirst({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);
  if (!shop) redirect("/dashboard");

  if (getBillingStatus(user).trialExpired) {
    return (
      <>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderBottom: "1px solid var(--line)",
            marginBottom: 24,
          }}
        >
          <span style={{ fontWeight: 700 }}>MarginSnap</span>
          <a href="/api/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Sign out
          </a>
        </header>
        <TrialEndedScreen />
      </>
    );
  }

  const [listings, mostRecentOrder, recentEntries] = await Promise.all([
    prisma.listing.findMany({ where: { shopId: shop.id }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.order.findFirst({ where: { shopId: shop.id }, orderBy: { orderDate: "desc" }, select: { currency: true } }),
    prisma.adSpendEntry.findMany({
      where: { listing: { shopId: shop.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { listing: { select: { title: true } } },
    }),
  ]);
  const currency = mostRecentOrder?.currency ?? null;

  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--line)",
          marginBottom: 24,
        }}
      >
        <span style={{ fontWeight: 700 }}>MarginSnap</span>
        <a href="/api/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Sign out
        </a>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
        <a href="/dashboard" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          ← Back to dashboard
        </a>
        <h1 style={{ fontSize: "1.4rem", margin: "8px 0 4px" }}>Ad spend</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Etsy doesn&rsquo;t give us your Ads spend automatically — there&rsquo;s no API for it and no export button on Etsy&rsquo;s
          side either. Bring it in yourself below (a one-off, every week or so) and it&rsquo;ll get subtracted from that
          listing&rsquo;s profit for whichever period it covers.
        </p>

        {listings.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No listings synced yet — go back to the dashboard and click &ldquo;Sync now.&rdquo;</p>
        ) : (
          <AdSpendImporter listings={listings} currency={currency} />
        )}

        {recentEntries.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Recently added</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="card"
                  style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 12px", fontSize: "0.85rem" }}
                >
                  <span>{entry.listing.title}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {entry.periodStart.toISOString().slice(0, 10)} → {entry.periodEnd.toISOString().slice(0, 10)}
                  </span>
                  <span>{formatMoney(Number(entry.amountSpent), entry.currency ?? currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
