import { Logo } from "@/components/Logo";

// Public site nav (2026-09-24, Bogdan's request: privacy/terms should show
// "the full top header of the site" instead of nothing) — pulled out of
// LandingPage.tsx's inline <nav> so it's one shared component instead of
// duplicating that markup a second time (same reasoning as SubpageHeader.tsx
// for the dashboard subpages). LandingPage.tsx itself is untouched and keeps
// its own inline copy for now, since its Pricing/Start-trial links are
// same-page anchors (#pricing/#start) that only make sense there; this
// version uses "/#pricing" and "/#start" instead so they still resolve
// correctly from privacy/terms (or any other page this gets used on) rather
// than silently doing nothing.
//
// Deliberately NOT session-aware (no Sign out / dashboard links) unlike
// SubpageHeader — privacy/terms are plain server components with no session
// check today, reachable whether signed in or out, so this stays exactly as
// public as they are.
export function PublicNav({ navId = "public-nav-toggle" }: { navId?: string }) {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid var(--line)",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <Logo />
      <input type="checkbox" id={navId} className="nav-toggle-checkbox" />
      <label htmlFor={navId} className="nav-toggle-label" aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </label>
      <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <a href="/#pricing" style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
          Pricing
        </a>
        <a href="/auth/signin" style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
          Sign in
        </a>
        <a href="/#start" className="button-accent" style={{ fontSize: "0.85rem" }}>
          Start free trial
        </a>
      </div>
    </nav>
  );
}
