import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CogsEditor, type CogsEntrySummary } from "@/components/CogsEditor";
import { DefaultShippingCostEditor } from "@/components/DefaultShippingCostEditor";
import { resolveCogsForDate } from "@/lib/cogs";
import { getBillingStatus } from "@/lib/billing";
import { isAdminUser } from "@/lib/admin";
import { TrialEndedScreen } from "@/components/TrialEndedScreen";
import { SubpageHeader } from "@/components/SubpageHeader";
import { Footer } from "@/components/Footer";

// "Manage costs" (Blueprint workflow §2) — the screen the rest of the app has
// been pointing at ("that entry screen is next up"). Type in what each item
// costs you to make; MarginSnap uses it for every order synced from here on
// — or, since 2026-09-16 (Bogdan's request), optionally retroactively too,
// with an explicit confirmation naming exactly how many orders it'll change
// (see CogsEditor.tsx and src/app/api/listings/[id]/cogs/route.ts).
export default async function ManageCosts() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const [shop, user] = await Promise.all([
    prisma.shop.findFirst({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);
  if (!shop) redirect("/dashboard");

  // Computed once and passed to every SubpageHeader below (2026-09-24) so
  // the header shows the same billing/Admin links as the main dashboard
  // header instead of just "Sign out" - see SubpageHeader.tsx.
  const billing = getBillingStatus(user);
  const isAdmin = isAdminUser(user);

  // This page is reachable directly by URL, not just via the dashboard —
  // needs its own trial-expired check rather than relying on the dashboard
  // having already gated it (see src/lib/billing.ts).
  if (billing.trialExpired) {
    return (
      <>
        <SubpageHeader navId="listings-nav-toggle" isSubscribed={billing.isPaying} isAdmin={isAdmin} />
        <TrialEndedScreen />
        <Footer />
      </>
    );
  }

  const [listings, mostRecentOrder] = await Promise.all([
    prisma.listing.findMany({
      where: { shopId: shop.id },
      orderBy: { title: "asc" },
      include: { cogsEntries: { orderBy: { effectiveFrom: "desc" } } },
    }),
    // Listing/Shop don't store a currency (Order does, from the real
    // receipt) — a shop is effectively one currency in practice, so the
    // most recent order's is a reasonable stand-in for the $/€/£ prefix on
    // the shipping-cost inputs below, rather than assuming dollars.
    prisma.order.findFirst({ where: { shopId: shop.id }, orderBy: { orderDate: "desc" }, select: { currency: true } }),
  ]);
  const currency = mostRecentOrder?.currency ?? null;
  const now = new Date();

  return (
    <>
      <SubpageHeader navId="listings-nav-toggle" isSubscribed={billing.isPaying} isAdmin={isAdmin} />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
        <a href="/dashboard" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          ← Back to dashboard
        </a>
        <h1 style={{ fontSize: "1.4rem", margin: "8px 0 4px" }}>Manage costs</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Type in what each item actually costs you to make (materials, packaging — whatever you
          count). Choose whether it applies from today, retroactively to every order, or from a
          specific date — retroactive changes ask you to confirm first and show exactly how many
          orders will change.
        </p>

        {listings.length === 0 && (
          <p style={{ color: "var(--muted)" }}>
            No listings synced yet — go back to the dashboard and click &ldquo;Sync now.&rdquo;
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {listings.map((listing) => {
            const currentEntry = resolveCogsForDate(listing.cogsEntries, now);
            const entrySummaries: CogsEntrySummary[] = listing.cogsEntries.map((e) => ({
              id: e.id,
              cogsAmount: Number(e.cogsAmount),
              effectiveFrom: e.effectiveFrom.toISOString().slice(0, 10),
            }));

            return (
              <div
                key={listing.id}
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <div>
                    <div>{listing.title}</div>
                    {listing.sku && (
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>SKU: {listing.sku}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--muted)", fontSize: "0.85rem", minWidth: 90 }}>Cost of goods</span>
                    <CogsEditor
                      listingId={listing.id}
                      currentCogs={currentEntry ? Number(currentEntry.cogsAmount) : null}
                      entries={entrySummaries}
                      currency={currency}
                    />
                  </div>
                  {/* Given its own top border + extra top padding
                     (2026-09-24, Bogdan's report) — with only the same 10px
                     gap as the row above it, this read as crowding right up
                     against the Cost of goods editor instead of as its own
                     separate field.

                     Explanation switched from a hover-title tooltip to a
                     plain always-visible caption (2026-09-24, second pass —
                     Bogdan reported the tooltip wasn't showing on PC OR
                     phone). A hover-only title="" was never going to work
                     reliably: phone browsers generally don't show title
                     tooltips on tap at all (no hover state to trigger), and
                     even on desktop it needs a precise, sustained hover on a
                     16px icon most people won't think to try — the .info-tip
                     class in globals.css is unused now, left in case a real
                     click/tap-to-reveal tooltip is worth building later. A
                     caption that's just always there needs no interaction
                     and works identically everywhere. */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      marginTop: 6,
                      paddingTop: 14,
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--muted)", fontSize: "0.85rem", minWidth: 90 }}>
                        Typical shipping cost
                      </span>
                      <DefaultShippingCostEditor
                        listingId={listing.id}
                        initialCost={listing.defaultShippingCost ? Number(listing.defaultShippingCost) : null}
                        currency={currency}
                      />
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: 0 }}>
                      What it typically costs YOU to ship this item — not what you charge the buyer.
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </>
  );
}
