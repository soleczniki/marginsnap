// Shared wordmark + mark (2026-09-17, LandingPage.tsx; pulled out into its
// own file 2026-09-18 so the dashboard header can use the exact same logo
// instead of the plain "MarginSnap" text it had been showing — Bogdan's
// request that the two match). The mark is an original price-tag shape, not
// a copy of any real brand's icon — tags fit both the craft aesthetic and
// the marketplace/for-sale connotation Bogdan asked for ("shapes reminiscent
// of Etsy") without borrowing anyone's actual logo.
//
// `size` scales the whole lockup (icon + text) proportionally — the
// dashboard header uses a smaller size than the landing page's hero.
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * (8 / 26) }}>
      <svg width={size} height={size} viewBox="0 0 26 26" style={{ transform: "rotate(-8deg)" }}>
        <path
          d="M2,13 L9,3 L23,3 L23,23 L9,23 Z"
          fill="var(--warm)"
          stroke="var(--ink)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="8" r="1.8" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />
      </svg>
      <span style={{ fontWeight: 800, fontSize: `${size * (1.1 / 26)}rem`, letterSpacing: "-0.01em" }}>
        Margin<span style={{ color: "var(--warm-ink)" }}>Snap</span>
      </span>
    </span>
  );
}
