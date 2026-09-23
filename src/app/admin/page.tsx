import type { CSSProperties } from "react";
import { prisma } from "@/lib/db";
import { requireAdminPage, isSuperAdminEmail } from "@/lib/admin";
import { getBillingStatus, type BillingStatus } from "@/lib/billing";
import { formatMoney } from "@/lib/money";
import { stripe } from "@/lib/stripe";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminToggle } from "@/components/AdminToggle";
import { Footer } from "@/components/Footer";

const thStyle: CSSProperties = { padding: "8px 10px", color: "var(--muted)", fontWeight: 600, fontSize: "0.8rem", textAlign: "left" };
const tdStyle: CSSProperties = { padding: "10px", borderBottom: "1px solid var(--line)", verticalAlign: "top", fontSize: "0.9rem" };
const statCardStyle: CSSProperties = { flex: "1 1 140px" };
const statLabelStyle: CSSProperties = { color: "var(--muted)", fontSize: "0.8rem", marginBottom: 4 };
const statValueStyle: CSSProperties = { fontSize: "1.4rem", fontWeight: 700 };

function badgeStyle(bg: string, color: string): CSSProperties {
  return {
    display: "inline-block",
    background: bg,
    color,
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: "0.78rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

function StatusBadge({ billing }: { billing: BillingStatus }) {
  if (billing.isPaying) return <span style={badgeStyle("var(--accent-soft)", "var(--accent-ink)")}>Paying</span>;
  if (billing.trialExpired) return <span style={badgeStyle("var(--loss-soft)", "var(--loss)")}>Trial expired</span>;
  if (billing.daysLeft !== null) {
    return <span style={badgeStyle("var(--surface-2)", "var(--muted)")}>Trial — {billing.daysLeft}d left</span>;
  }
  return <span style={badgeStyle("var(--surface-2)", "var(--muted)")}>Unrestricted (legacy)</span>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

// Admin users list (2026-09-23, Bogdan's request) — the one place to see
// every MarginSnap account, their trial/paying status, their connected
// shop, and (for the superadmin) grant or revoke other admins. Per-user
// live Stripe detail (invoices, real subscription state) lives one click
// away on /admin/users/[id] rather than here — fetching that live for every
// row on this list would mean one Stripe API call per user just to render
// the table, which doesn't scale and isn't needed for an overview.
export default async function AdminUsersPage() {
  const viewer = await requireAdminPage();
  const viewerIsSuperAdmin = isSuperAdminEmail(viewer.email);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { shops: { take: 1 } },
  });

  const rows = users.map((user) => ({ user, billing: getBillingStatus(user) }));
  // The superadmin account is never trial/billing-gated at all — it's
  // redirected to /admin before billing is even checked (see
  // dashboard/page.tsx and src/lib/admin.ts) — so its billing status is
  // meaningless and shouldn't count toward these stats or show a
  // Trial/Paying badge in the table below.
  const billableRows = rows.filter((r) => !isSuperAdminEmail(r.user.email));
  const payingCount = billableRows.filter((r) => r.billing.isPaying).length;
  const trialActiveCount = billableRows.filter((r) => !r.billing.isPaying && r.billing.trialActive && r.billing.daysLeft !== null).length;
  const trialExpiredCount = billableRows.filter((r) => r.billing.trialExpired).length;

  // Best-effort MRR estimate from the live Price — never blocks the page if
  // STRIPE_PRICE_ID is missing/misconfigured or Stripe can't be reached.
  let mrrLabel = "—";
  try {
    if (payingCount === 0) {
      mrrLabel = formatMoney(0, "USD");
    } else if (process.env.STRIPE_PRICE_ID) {
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
      if (price.unit_amount != null) {
        mrrLabel = formatMoney((price.unit_amount / 100) * payingCount, price.currency.toUpperCase());
      }
    }
  } catch {
    // leave the dash
  }

  return (
    <>
      {/* No "back to dashboard" link for the superadmin (2026-09-23) — that
         account is redirected straight back here from /dashboard (see
         dashboard/page.tsx), so the link would just point back at this same
         page. A regular promoted admin can still be a real seller with an
         actual dashboard to return to, so they keep the link. */}
      <AdminHeader {...(viewerIsSuperAdmin ? {} : { backHref: "/dashboard", backLabel: "← Back to dashboard" })} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 4 }}>Admin</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          {users.length} user{users.length === 1 ? "" : "s"} total.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard label="Total users" value={String(users.length)} />
          <StatCard label="Paying" value={String(payingCount)} />
          <StatCard label="Est. MRR" value={mrrLabel} />
          <StatCard label="Trial active" value={String(trialActiveCount)} />
          <StatCard label="Trial expired" value={String(trialExpiredCount)} />
        </div>

        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Signed up</th>
                <th style={thStyle}>Shop</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Stripe customer</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ user, billing }) => {
                const shop = user.shops[0];
                const isSuper = isSuperAdminEmail(user.email);
                return (
                  <tr key={user.id}>
                    <td style={tdStyle}>{user.email}</td>
                    <td style={tdStyle}>{user.createdAt.toLocaleDateString()}</td>
                    <td style={tdStyle}>{shop?.shopName ?? "—"}</td>
                    <td style={tdStyle}>
                      {isSuper ? <span style={{ color: "var(--muted)" }}>—</span> : <StatusBadge billing={billing} />}
                    </td>
                    <td style={tdStyle}>
                      {user.stripeCustomerId ? (
                        <a
                          href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.8rem" }}
                        >
                          {user.stripeCustomerId.slice(0, 16)}…
                        </a>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {isSuper ? (
                        <span style={badgeStyle("var(--warm-soft)", "var(--warm-ink)")}>Superadmin</span>
                      ) : user.isAdmin ? (
                        <span style={badgeStyle("var(--accent-soft)", "var(--accent-ink)")}>Admin</span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <a href={`/admin/users/${user.id}`} style={{ fontSize: "0.85rem", marginRight: 12 }}>
                        Details →
                      </a>
                      {viewerIsSuperAdmin && !isSuper && <AdminToggle userId={user.id} initialValue={user.isAdmin} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}
