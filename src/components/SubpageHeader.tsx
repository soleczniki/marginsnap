import { Logo } from "@/components/Logo";

// Shared header for the dashboard's secondary pages (Ad spend, Settings,
// Manage costs) — 2026-09-23 fix. These had each hand-rolled their own
// header (twice per file, once for the trial-expired early return, once for
// the normal render) using a plain "MarginSnap" text span instead of the
// real Logo mark, a direct "/api/auth/signout" link instead of the styled
// confirmation page (src/app/auth/signout/page.tsx), and — since that
// predates the mobile hamburger-nav work in dashboard/page.tsx/
// LandingPage.tsx — no hamburger at all, so it visibly didn't match the
// rest of the app once that shipped (Bogdan's report: "the logo here is
// shitty old" / "the hamburger is gone it should be here too"). One shared
// component now instead of tripling the same markup a fourth time.
//
// 2026-09-24 (Bogdan's report: still only showed "Sign out" here, should be
// the same full menu as the rest of the app) — now mirrors every nav-links
// item from the main dashboard header (src/app/dashboard/page.tsx) instead
// of just Sign out: billing, Costs, Ad spend, Settings, Admin (conditional).
// isSubscribed/isAdmin are passed in as plain booleans rather than this
// component importing getBillingStatus/isAdminUser itself, so it stays a
// dumb presentational component and each caller computes them from whatever
// `user` it already fetches (see listings/ad-spend/settings page.tsx).
// Still wrapped in the same checkbox+label hamburger pattern as the main
// dashboard header (globals.css's ".nav-toggle-checkbox"/".nav-links").
// navId must be unique if this ever renders twice on the same page (it
// doesn't today - each page uses it once).
export function SubpageHeader({
  navId = "subpage-nav-toggle",
  isSubscribed,
  isAdmin,
}: {
  navId?: string;
  isSubscribed: boolean;
  isAdmin: boolean;
}) {
  return (
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
      <input type="checkbox" id={navId} className="nav-toggle-checkbox" />
      <label htmlFor={navId} className="nav-toggle-label" aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </label>
      <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
        {isAdmin && (
          <a href="/admin" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Admin
          </a>
        )}
        <a href="/auth/signout" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          Sign out
        </a>
      </div>
    </header>
  );
}
