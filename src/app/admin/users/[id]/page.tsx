import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminPage, isSuperAdminEmail } from "@/lib/admin";
import { getBillingStatus } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import { stripe } from "@/lib/stripe";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminToggle } from "@/components/AdminToggle";

const sectionTitleStyle: CSSProperties = { fontSize: "1rem", marginBottom: 14 };
const subTitleStyle: CSSProperties = { fontSize: "0.9rem", color: "var(--muted)", marginBottom: 10 };
const dlStyle: CSSProperties = { display: "grid", gridTemplateColumns: "200px 1fr", rowGap: 6, margin: 0 };
const thStyle: CSSProperties = { padding: "8px 10px", color: "var(--muted)", fontWeight: 600, fontSize: "0.78rem", textAlign: "left" };
const tdStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--line)", fontSize: "0.88rem" };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };

function badgeStyle(bg: string, color: string): CSSProperties {
  return { display: "inline-block", background: bg, color, borderRadius: 6, padding: "3px 8px", fontSize: "0.78rem", fontWeight: 600 };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{label}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </>
  );
}

// One user's full picture for the superadmin/admins (2026-09-23, Bogdan's
// request): stored billing state alongside LIVE data pulled straight from
// Stripe on every load (subscriptions + invoices) — deliberately not
// duplicated into our own DB, so this always reflects Stripe's real state
// rather than a copy that can drift. See src/lib/admin.ts for the
// superadmin/admin model this page is gated by.
export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const viewer = await requireAdminPage();
  const viewerIsSuperAdmin = isSuperAdminEmail(viewer.email);

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: { shops: true },
  });
  if (!user) notFound();

  const billing = getBillingStatus(user);
  const shop = user.shops[0];
  const isSuper = isSuperAdminEmail(user.email);

  const [orderCount, listingCount] = shop
    ? await Promise.all([
        prisma.order.count({ where: { shopId: shop.id } }),
        prisma.listing.count({ where: { shopId: shop.id } }),
      ])
    : [0, 0];

  // Best-effort: a stripeCustomerId created before the live-mode switch (or
  // one left over from the old sandbox account, see PROJECT.md) won't
  // resolve against the live secret key now configured — show that plainly
  // instead of crashing the page.
  let stripeError: string | null = null;
  let subscriptions: Awaited<ReturnType<typeof stripe.subscriptions.list>>["data"] = [];
  let invoices: Awaited<ReturnType<typeof stripe.invoices.list>>["data"] = [];
  if (user.stripeCustomerId) {
    try {
      const [subsRes, invoicesRes] = await Promise.all([
        stripe.subscriptions.list({ customer: user.stripeCustomerId, status: "all", limit: 10 }),
        stripe.invoices.list({ customer: user.stripeCustomerId, limit: 20 }),
      ]);
      subscriptions = subsRes.data;
      invoices = invoicesRes.data;
    } catch (err) {
      stripeError =
        err instanceof Error ? `Couldn't load this from Stripe: ${err.message}` : "Couldn't load this from Stripe.";
    }
  }

  return (
    <>
      <AdminHeader backHref="/admin" backLabel="← All users" />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>{user.email}</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "0.85rem" }}>
          Signed up {user.createdAt.toLocaleString()} · ID <code>{user.id}</code>
        </p>

        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitleStyle}>Billing</h2>
          <dl style={dlStyle}>
            <Row label="Status">
              {isSuper
                ? "Not applicable — the superadmin account is never trial/billing-gated"
                : billing.isPaying
                ? "Paying (active subscription)"
                : billing.trialExpired
                ? "Trial expired — not paying"
                : billing.daysLeft !== null
                ? `Trial — ${billing.daysLeft} day${billing.daysLeft === 1 ? "" : "s"} left`
                : "Unrestricted (legacy account, no trial clock)"}
            </Row>
            <Row label="subscriptionStatus (stored)">{user.subscriptionStatus ?? "—"}</Row>
            <Row label="Stripe customer">
              {user.stripeCustomerId ? (
                <a href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`} target="_blank" rel="noreferrer">
                  {user.stripeCustomerId}
                </a>
              ) : (
                "No Stripe customer yet"
              )}
            </Row>
            <Row label="Trial ends">{isSuper ? "—" : user.trialEndsAt ? user.trialEndsAt.toLocaleString() : "—"}</Row>
          </dl>
        </div>

        {user.stripeCustomerId && (
          <div className="card" style={{ marginBottom: 20 }}>
            <h2 style={sectionTitleStyle}>Live from Stripe</h2>
            {stripeError ? (
              <p style={{ color: "var(--loss)", fontSize: "0.9rem" }}>{stripeError}</p>
            ) : (
              <>
                <h3 style={subTitleStyle}>Subscriptions</h3>
                {subscriptions.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 20 }}>
                    No subscriptions on this Stripe customer.
                  </p>
                ) : (
                  <table style={{ ...tableStyle, marginBottom: 20 }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}>Price</th>
                        <th style={thStyle}>Current period end</th>
                        <th style={thStyle}>Cancels at period end?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptions.map((sub) => {
                        const item = sub.items.data[0];
                        // current_period_end has lived in slightly different
                        // places across recent Stripe API versions — read it
                        // defensively rather than assuming one shape.
                        const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
                          ?? (item as unknown as { current_period_end?: number } | undefined)?.current_period_end;
                        return (
                          <tr key={sub.id}>
                            <td style={tdStyle}>{sub.status}</td>
                            <td style={tdStyle}>
                              {item?.price.unit_amount != null
                                ? formatMoney(item.price.unit_amount / 100, item.price.currency.toUpperCase())
                                : "—"}
                            </td>
                            <td style={tdStyle}>{periodEnd ? new Date(periodEnd * 1000).toLocaleDateString() : "—"}</td>
                            <td style={tdStyle}>{sub.cancel_at_period_end ? "Yes" : "No"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <h3 style={subTitleStyle}>Invoices</h3>
                {invoices.length === 0 ? (
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No invoices yet.</p>
                ) : (
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Amount paid</th>
                        <th style={thStyle}>Status</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td style={tdStyle}>{new Date(inv.created * 1000).toLocaleDateString()}</td>
                          <td style={tdStyle}>{formatMoney(inv.amount_paid / 100, inv.currency.toUpperCase())}</td>
                          <td style={tdStyle}>
                            <span
                              style={badgeStyle(
                                inv.status === "paid" ? "var(--accent-soft)" : "var(--loss-soft)",
                                inv.status === "paid" ? "var(--accent-ink)" : "var(--loss)"
                              )}
                            >
                              {inv.status ?? "—"}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            {inv.hosted_invoice_url && (
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem" }}>
                                View →
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={sectionTitleStyle}>Shop</h2>
          {shop ? (
            <dl style={dlStyle}>
              <Row label="Name">{shop.shopName ?? "—"}</Row>
              <Row label="Etsy shop ID">{shop.etsyShopId?.toString() ?? "—"}</Row>
              <Row label="Country">{shop.sellerCountry ?? "—"}</Row>
              <Row label="Has valid VAT ID">{shop.sellerHasValidVatId ? "Yes" : "No"}</Row>
              <Row label="Shipping net-zero default">{shop.assumeShippingNetZero ? "Yes" : "No"}</Row>
              <Row label="Last synced">{shop.lastSyncedAt ? shop.lastSyncedAt.toLocaleString() : "Never"}</Row>
              <Row label="Onboarded">{shop.onboardedAt ? shop.onboardedAt.toLocaleString() : "Not yet"}</Row>
              <Row label="Listings">{listingCount}</Row>
              <Row label="Orders">{orderCount}</Row>
            </dl>
          ) : (
            <p style={{ color: "var(--muted)" }}>No Etsy shop connected yet.</p>
          )}
        </div>

        {viewerIsSuperAdmin && !isSuper && (
          <div className="card">
            <h2 style={sectionTitleStyle}>Admin access</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: 12 }}>
              Grants this account access to /admin. Doesn&rsquo;t affect their billing or their own dashboard.
            </p>
            <AdminToggle userId={user.id} initialValue={user.isAdmin} />
          </div>
        )}
      </main>
    </>
  );
}
