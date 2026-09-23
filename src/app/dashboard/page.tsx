import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SyncButton } from "@/components/SyncButton";
import { OrdersTable, type OrderRowItem, type OrderTableRow } from "@/components/OrdersTable";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ShippingModeToggle } from "@/components/ShippingModeToggle";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { DashboardTabs, type ViewKey } from "@/components/DashboardTabs";
import { ProductsTable } from "@/components/ProductsTable";
import { formatMoney } from "@/lib/money";
import { isPeriodKey, periodRange, toDateInputValue, type PeriodKey } from "@/lib/periods";
import { aggregateByListing, orderCogsFees, type OrderWithItems } from "@/lib/profitability";
import { resolveCogsForDate } from "@/lib/cogs";
import { getNotifications } from "@/lib/notifications";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { getBillingStatus } from "@/lib/billing";
import { TrialEndedScreen } from "@/components/TrialEndedScreen";
import { Logo } from "@/components/Logo";
import { isAdminUser } from "@/lib/admin";

function isViewKey(value: string | undefined): value is ViewKey {
  return value === "orders" || value === "products";
}

// V1 of the dashboard (Blueprint workflow §4), now Phase-2 shaped
// (PROJECT.md roadmap): a period picker, orders grouped by day, and a
// per-product profitability table — not just a flat recent-orders list.
export default async function Dashboard({
  searchParams,
}: {
  searchParams: {
    connected?: string;
    period?: string;
    shipping?: string;
    view?: string;
    start?: string;
    end?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const [shop, user] = await Promise.all([
    prisma.shop.findFirst({ where: { userId: session.user.id } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);

  // Single source of truth for trial/paid gating — see src/lib/billing.ts.
  const billing = getBillingStatus(user);
  const isSubscribed = billing.isPaying;

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
      <Logo />
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <a
          href={isSubscribed ? "/api/stripe/portal" : "/api/stripe/checkout"}
          style={{ fontSize: "0.85rem", color: "var(--muted)" }}
        >
          {isSubscribed ? "Manage billing" : "Subscribe — $9/mo"}
        </a>
        <a href="/dashboard/listings" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Costs
        </a>
        <a href="/dashboard/ad-spend" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Ad spend
        </a>
        <a href="/dashboard/settings" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Settings
        </a>
        {isAdminUser(user) && (
          <a href="/admin" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Admin
          </a>
        )}
        <a href="/api/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Sign out
        </a>
      </div>
    </header>
  );

  // Trial-expired gate (2026-09-17): checked before the "no shop yet" case
  // too, since the trial clock starts at signup, not at Etsy-connect — a
  // slow signup that never got to connecting Etsy still burns trial days
  // and should still see this once it's over, not the "connect Etsy" screen.
  if (billing.trialExpired) {
    return (
      <>
        {header}
        <TrialEndedScreen />
      </>
    );
  }

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

  const viewKey: ViewKey = isViewKey(searchParams.view) ? searchParams.view : "orders";

  // Custom date range ("Custom dates" trigger, CustomDatePicker.tsx,
  // 2026-09-16 request): only actually used when both start and end parse
  // to valid dates — otherwise this silently falls back to the 30-day
  // default rather than crashing on a malformed/incomplete URL.
  const rawPeriodKey: PeriodKey = isPeriodKey(searchParams.period) ? searchParams.period : "30d";
  let customRange: { start: Date; end: Date } | undefined;
  if (rawPeriodKey === "custom" && searchParams.start && searchParams.end) {
    const parsedStart = new Date(`${searchParams.start}T00:00:00.000Z`);
    const parsedEnd = new Date(`${searchParams.end}T23:59:59.999Z`);
    if (!Number.isNaN(parsedStart.getTime()) && !Number.isNaN(parsedEnd.getTime())) {
      customRange = parsedStart <= parsedEnd ? { start: parsedStart, end: parsedEnd } : { start: parsedEnd, end: parsedStart };
    }
  }
  const periodKey: PeriodKey = rawPeriodKey === "custom" && !customRange ? "30d" : rawPeriodKey;
  const { start, end } = periodRange(periodKey, new Date(), customRange);

  // Shipping mode: the dashboard's view-only quick toggle (ShippingModeToggle)
  // can override the shop's stored default (Shop.assumeShippingNetZero) for
  // just this render — never written back. `shippingOverride` stays exactly
  // what's in the URL (or undefined) so PeriodPicker only carries it forward
  // when the user actually chose one — see PeriodPicker.tsx.
  const shippingOverride: "count" | "exclude" | undefined =
    searchParams.shipping === "count" || searchParams.shipping === "exclude" ? searchParams.shipping : undefined;
  const assumeNetZero: boolean =
    shippingOverride === "exclude" ? true : shippingOverride === "count" ? false : shop.assumeShippingNetZero;
  const shippingMode: "count" | "exclude" = assumeNetZero ? "exclude" : "count";

  const [orders, listings, periodAdSpend, totalAdSpendCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        shopId: shop.id,
        ...(start ? { orderDate: { gte: start, lte: end } } : {}),
      },
      orderBy: { orderDate: "desc" },
      include: { lineItems: { include: { listing: true } } },
    }),
    prisma.listing.findMany({ where: { shopId: shop.id }, include: { cogsEntries: true } }),
    // Ad spend (2026-09-17): overlap with the selected period, not exact
    // containment — a seller's Etsy report might span "Sep 1-15" while the
    // dashboard's showing "last 7 days"; summing anything that overlaps at
    // all is a deliberate v1 simplification over trying to prorate it, see
    // profitability.ts. `start: null` (the "all time" view) just means no
    // lower bound, matching how orders are already queried above.
    prisma.adSpendEntry.findMany({
      where: {
        listing: { shopId: shop.id },
        periodStart: { lte: end },
        ...(start ? { periodEnd: { gte: start } } : {}),
      },
      select: { listingId: true, amountSpent: true },
    }),
    prisma.adSpendEntry.count({ where: { listing: { shopId: shop.id } } }),
  ]);
  const adSpendByListing: Record<string, number> = {};
  for (const entry of periodAdSpend) {
    adSpendByListing[entry.listingId] = (adSpendByListing[entry.listingId] ?? 0) + Number(entry.amountSpent);
  }

  // First-time onboarding (2026-09-17): once the first sync has produced at
  // least one listing, send a not-yet-onboarded shop through the wizard
  // exactly once — see src/app/dashboard/onboarding/page.tsx. Before that
  // (no listings yet, still syncing), just show the normal dashboard so
  // this doesn't get stuck waiting on a redirect target with nothing to show.
  if (!shop.onboardedAt && listings.length > 0) {
    redirect("/dashboard/onboarding");
  }

  const listingsMissingCogs = listings.filter((l) => resolveCogsForDate(l.cogsEntries, new Date()) === null).length;

  // Cast once here (Prisma's generated type already matches OrderWithItems;
  // this is just the Decimal→number boundary the rest of this file assumes).
  const ordersWithItems = orders as unknown as OrderWithItems[];
  const products = aggregateByListing(ordersWithItems, assumeNetZero, adSpendByListing);

  function toOrderRowItems(order: OrderWithItems): OrderRowItem[] {
    return order.lineItems.map((li) => ({
      title: li.listing.title,
      quantity: li.quantity,
      imageUrl: li.listing.imageUrl,
      etsyListingId: li.listing.etsyListingId.toString(),
    }));
  }

  function toOrderTableRow(order: OrderWithItems): OrderTableRow {
    const { totalFees, netProfit, shippingUnknown } = orderCogsFees(order, assumeNetZero);
    let profitLabel: string;
    if (netProfit !== null) {
      profitLabel = `${netProfit >= 0 ? "+" : ""}${formatMoney(netProfit, order.currency)}`;
    } else if (totalFees === null) {
      profitLabel = "fees pending — sync again";
    } else if (shippingUnknown) {
      profitLabel = "add shipping cost to see profit";
    } else {
      profitLabel = "add cost to see profit";
    }
    return {
      id: order.id,
      receiptId: order.etsyReceiptId.toString(),
      orderDate: order.orderDate,
      items: toOrderRowItems(order),
      grossAmount: Number(order.grossAmount),
      currency: order.currency,
      feesBreakdown: order.feesBreakdown as OrderTableRow["feesBreakdown"],
      netProfit,
      profitLabel,
      shippingCostAtSale: order.shippingCostAtSale !== null ? Number(order.shippingCostAtSale) : null,
      shippingUnknown,
      singleListingId: singleListingIdOf(order),
    };
  }

  // Same "single listing on this order" check sync.ts and
  // apply-default-shipping-cost/route.ts already use to decide when a
  // listing's default shipping cost is safe to apply — reused here so
  // ShippingCostEditor's "Save and apply" action only shows up where it's
  // actually safe to run.
  function singleListingIdOf(order: OrderWithItems): string | null {
    const distinctListingIds = new Set(order.lineItems.map((li) => li.listingId));
    return distinctListingIds.size === 1 ? order.lineItems[0].listingId : null;
  }

  return (
    <>
      {header}
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px 80px" }}>
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
          </div>
          {/* Sync details moved under the button itself (2026-09-18, Bogdan's
             request) — previously sat under the shop name on the left,
             disconnected from the button that actually triggers a sync. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <SyncButton />
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", textAlign: "right", margin: 0 }}>
              {shop.lastSyncedAt ? (
                <>
                  Last synced {shop.lastSyncedAt.toLocaleString()}
                  <br />
                  {listings.length} listing{listings.length === 1 ? "" : "s"} synced
                </>
              ) : (
                "Not synced yet — click Sync now, or wait for the daily automatic sync."
              )}
            </p>
          </div>
        </div>

        <NotificationsPanel
          notifications={getNotifications({
            listingsMissingCogsCount: listingsMissingCogs,
            trialDaysLeft: billing.trialActive ? billing.daysLeft : null,
          })}
        />

        <DashboardTabs
          active={viewKey}
          period={periodKey}
          shipping={shippingOverride}
          start={periodKey === "custom" ? searchParams.start : undefined}
          end={periodKey === "custom" ? searchParams.end : undefined}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
          <PeriodPicker active={periodKey} shipping={shippingOverride} view={viewKey} />
          <CustomDatePicker
            active={periodKey === "custom"}
            start={periodKey === "custom" ? searchParams.start : start ? toDateInputValue(start) : undefined}
            end={toDateInputValue(end)}
            shipping={shippingOverride}
            view={viewKey}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <ShippingModeToggle
            active={shippingMode}
            period={periodKey}
            view={viewKey}
            start={periodKey === "custom" ? searchParams.start : undefined}
            end={periodKey === "custom" ? searchParams.end : undefined}
          />
        </div>

        {/* Ad spend disclosure (2026-09-17, Bogdan's request): Etsy gives us
           no way to tie ad spend to one order, so the Orders tab's profit
           NEVER includes it, by design — that's worth saying plainly rather
           than leaving it to look like an oversight. The Products tab does
           subtract it (see profitability.ts), but only for whatever's
           actually been entered — until at least one entry exists, say so
           there too instead of leaving a silently-optimistic number. */}
        {viewKey === "orders" ? (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 12 }}>
            Profit above doesn&rsquo;t include Etsy Ads spend — it can&rsquo;t be tied to one order. See the Products tab for
            that, once you&rsquo;ve <a href="/dashboard/ad-spend">added your ad spend</a>.
          </p>
        ) : totalAdSpendCount === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginBottom: 12 }}>
            Profit above doesn&rsquo;t include Etsy Ads spend yet — <a href="/dashboard/ad-spend">add it here</a> to see the
            full picture.
          </p>
        ) : null}

        {viewKey === "orders" ? (
          <>
            {orders.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <a href="/api/export/csv" className="button" style={{ fontSize: "0.85rem" }}>
                  Export CSV
                </a>
              </div>
            )}
            <OrdersTable orders={ordersWithItems.map(toOrderTableRow)} assumeNetZero={assumeNetZero} />
          </>
        ) : (
          <ProductsTable products={products} />
        )}
      </main>
    </>
  );
}
