import type { CSSProperties } from "react";
import { SignInForm } from "@/components/SignInForm";

// The actual marketing site for marginsnap.app's root URL (2026-09-17,
// Bogdan's request — "make it sexy, make it sellable"). Before this, a
// signed-out visitor to the bare domain saw nothing but the sign-in form —
// no pitch, no pricing, no reason to trust it. This is a server component
// (no interactivity of its own) that wraps that same SignInForm — same
// email/magic-link mechanics, no separate signup flow — inside real sales
// copy. src/app/page.tsx still checks the session first and redirects a
// signed-in visitor straight to /dashboard; this only ever renders for a
// signed-out one.
//
// Style direction (Bogdan's call, 2026-09-17): warm/craft-leaning rather
// than generic dark SaaS — which the existing palette in globals.css
// (sage green accent, off-white paper) already leans toward, so this reuses
// those CSS variables rather than introducing a second palette. Headline
// strategy: blend all three angles discussed rather than pick one — the
// hero leads with the pain point, a comparison section positions against
// spreadsheets/Sellerboard, and the trial/pricing sections lead with
// "no card, cancel anytime" to reduce signup friction. Pricing shown
// plainly (not hidden behind the CTA), per Bogdan's call. No real product
// screenshots yet (Bogdan didn't have any ready) — the "profit breakdown"
// card below is a labeled illustrative example, not a claimed screenshot.
export function LandingPage() {
  return (
    <>
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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="#pricing" style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
            Pricing
          </a>
          <a href="#start" style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
            Sign in
          </a>
          <a href="#start" className="button-accent" style={{ fontSize: "0.85rem" }}>
            Start free trial
          </a>
        </div>
      </nav>

      {/* ---------- Hero: leads with the pain point ---------- */}
      <header style={{ maxWidth: 1080, margin: "0 auto", padding: "64px 24px 40px" }}>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 420px" }}>
            <p
              style={{
                display: "inline-block",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--warm-ink)",
                background: "var(--warm-soft)",
                padding: "5px 12px",
                borderRadius: 20,
                marginBottom: 18,
              }}
            >
              Built for solo Etsy sellers
            </p>
            <h1 style={{ fontSize: "2.5rem", lineHeight: 1.15, marginBottom: 18 }}>
              Know if you actually made money on that sale.
            </h1>
            <p style={{ fontSize: "1.1rem", color: "var(--muted)", lineHeight: 1.55, marginBottom: 28 }}>
              Etsy shows you what you sold. It doesn&rsquo;t show you what fees, shipping, and
              materials took back out of it. MarginSnap connects to your shop and works that out
              automatically — the profit picture Sellerboard gives bigger sellers, sized for one
              person running an Etsy shop.
            </p>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <a href="#start" className="button-accent" style={{ fontSize: "1rem", padding: "13px 24px" }}>
                Start your free trial
              </a>
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                30 days free · no card required
              </span>
            </div>
          </div>

          <div style={{ flex: "1 1 320px", display: "flex", justifyContent: "center", position: "relative" }}>
            <HeroShapes />
            <ProfitExampleCard />
          </div>
        </div>
      </header>

      {/* ---------- The problem, elaborated ---------- */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 56px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          <FeatureBlurb
            emoji="🧾"
            title="Fees that don't show up anywhere"
            body="Transaction fees, payment processing, offsite ads, currency conversion, VAT on fees — Etsy takes a cut in more places than your shop stats ever mention."
          />
          <FeatureBlurb
            emoji="📦"
            title="Shipping you paid for, not just charged for"
            body="What a buyer paid for shipping and what it actually cost you to mail it are two different numbers. Most tools only track the first one."
          />
          <FeatureBlurb
            emoji="🧵"
            title="Materials cost creeping up"
            body="Your supplies got pricier six months ago, but your listing price didn't move. Without tracking cost history, that erosion is invisible."
          />
        </div>
      </section>

      {/* ---------- How it works / comparison angle ---------- */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 24px 56px" }}>
        <h2 style={{ fontSize: "1.6rem", textAlign: "center", marginBottom: 8 }}>
          A Sellerboard for one-person Etsy shops
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted)", maxWidth: 560, margin: "0 auto 36px" }}>
          Not a spreadsheet you maintain. Not an accounting suite built for teams. Just: connect
          your shop, and see real profit.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 40 }}>
          <StepBlurb step="1" title="Connect your Etsy shop" body="One OAuth click. Nothing to upload, nothing to export — MarginSnap reads your listings and orders directly." />
          <StepBlurb step="2" title="We do the fee math" body="Every fee, VAT rule, and currency conversion Etsy applies, calculated automatically and kept current." />
          <StepBlurb step="3" title="See real profit, instantly" body="Per order and per product, for any date range — what you kept, not just what you sold." />
        </div>

        <ComparisonTable />
      </section>

      {/* ---------- Trust / low-friction trial ---------- */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 56px", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Try it before you pay a cent</h2>
        <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Every account gets 30 days free, starting the moment you sign up. No credit card, no
          &ldquo;trial ending, enter your card now&rdquo; bait-and-switch &mdash; just the product,
          working on your real shop. If it&rsquo;s not for you, walk away; your data stays put
          either way.
        </p>
      </section>

      {/* ---------- Pricing, shown plainly ---------- */}
      <section id="pricing" style={{ maxWidth: 480, margin: "0 auto", padding: "24px 24px 64px" }}>
        <div className="card" style={{ textAlign: "center", padding: "36px 32px", borderTop: "3px solid var(--warm)" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            One plan. Everything included.
          </p>
          <p style={{ marginBottom: 20 }}>
            <span style={{ fontSize: "2.6rem", fontWeight: 700 }}>$9</span>
            <span style={{ color: "var(--muted)" }}>/month</span>
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", color: "var(--muted)", lineHeight: 2, textAlign: "left", display: "inline-block" }}>
            <li>✓ Unlimited orders &amp; listings</li>
            <li>✓ Daily automatic sync from Etsy</li>
            <li>✓ Fee-aware profit, per order &amp; per product</li>
            <li>✓ Dated cost-of-goods history</li>
            <li>✓ CSV export</li>
          </ul>
          <a href="#start" className="button-accent" style={{ width: "100%", fontSize: "1rem" }}>
            Start your 30-day free trial
          </a>
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 12 }}>
            No card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ---------- Final CTA: the actual sign-in/sign-up form ---------- */}
      <section style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
        <SignInForm
          id="start"
          title="Start your free trial"
          subtitle="Enter your email — we'll send a sign-in link. New here? This creates your account and starts your 30-day free trial, no card needed."
        />
      </section>

      <footer style={{ textAlign: "center", padding: "24px", fontSize: "0.82rem", color: "var(--muted)" }}>
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </footer>
    </>
  );
}

// Wordmark + mark (2026-09-17, replacing the bare "🧵 MarginSnap" text —
// Bogdan's feedback that the logo "needs work"). The mark is an original
// price-tag shape, not a copy of any real brand's icon — tags fit both the
// craft aesthetic and the marketplace/for-sale connotation Bogdan asked
// for ("shapes reminiscent of Etsy") without borrowing anyone's actual logo.
function Logo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ transform: "rotate(-8deg)" }}>
        <path
          d="M2,13 L9,3 L23,3 L23,23 L9,23 Z"
          fill="var(--warm)"
          stroke="var(--ink)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="8" r="1.8" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1" />
      </svg>
      <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
        Margin<span style={{ color: "var(--warm-ink)" }}>Snap</span>
      </span>
    </span>
  );
}

// Small tag-shaped confetti + a soft color blob behind the hero's example
// card — decorative only, purely to add some warmth/color to what was a
// flat gray hero (Bogdan's feedback, 2026-09-17). Absolutely positioned
// against the "position: relative" wrapper in the hero; aria-hidden since
// none of this carries information.
function HeroShapes() {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "5%",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "var(--warm-soft)",
          filter: "blur(2px)",
          opacity: 0.9,
        }}
      />
      <TagShape style={{ position: "absolute", top: "-6%", left: "-4%", transform: "rotate(18deg)" }} size={30} />
      <TagShape style={{ position: "absolute", bottom: "4%", right: "-2%", transform: "rotate(-25deg)" }} size={22} />
    </div>
  );
}

function TagShape({ size = 24, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" style={style}>
      <path d="M2,13 L9,3 L23,3 L23,23 L9,23 Z" fill="var(--warm)" opacity={0.85} />
      <circle cx="9" cy="8" r="1.8" fill="var(--paper)" />
    </svg>
  );
}

function FeatureBlurb({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <div className="card">
      <div style={{ fontSize: "1.6rem", marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

function StepBlurb({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--warm)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        {step}
      </div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

// Illustrative example only — not a screenshot of the real dashboard (no
// real screenshots were ready as of 2026-09-17; swap this for one later).
// Numbers are a made-up, round example, not any real seller's data.
function ProfitExampleCard() {
  const rows: [string, string][] = [
    ["Sale price", "$42.00"],
    ["Etsy fees", "−$9.87"],
    ["Payment processing", "−$1.35"],
    ["Shipping you paid", "−$4.20"],
    ["Materials", "−$8.50"],
  ];
  return (
    <div className="card" style={{ width: "100%", maxWidth: 320, transform: "rotate(-1.5deg)" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 12 }}>
        Example order &mdash; illustrative only
      </p>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "0.9rem" }}>
          <span style={{ color: "var(--muted)" }}>{label}</span>
          <span>{value}</span>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          paddingTop: 12,
          borderTop: "1px solid var(--line)",
          fontWeight: 700,
        }}
      >
        <span>You kept</span>
        <span className="profit-positive">$18.08</span>
      </div>
    </div>
  );
}

function ComparisonTable() {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
            <th style={{ padding: "10px 12px" }}></th>
            <th style={{ padding: "10px 12px" }}>A spreadsheet</th>
            <th style={{ padding: "10px 12px" }}>Sellerboard / Craftybase</th>
            <th style={{ padding: "10px 12px", color: "var(--warm-ink)" }}>MarginSnap</th>
          </tr>
        </thead>
        <tbody>
          <ComparisonRow label="Setup time" spreadsheet="Hours, and upkeep every week" others="Setup for multi-channel teams" marginsnap="Minutes — connect and go" />
          <ComparisonRow label="Built for Etsy specifically" spreadsheet="You look up every fee rule yourself" others="Etsy is one of many marketplaces supported" marginsnap="Etsy fees, VAT, and shipping built in" />
          <ComparisonRow label="Price" spreadsheet="Free, but costs you hours" others="$15–$79/mo" marginsnap="$9/mo, one plan" />
        </tbody>
      </table>
    </div>
  );
}

function ComparisonRow({ label, spreadsheet, others, marginsnap }: { label: string; spreadsheet: string; others: string; marginsnap: string }) {
  return (
    <tr style={{ borderBottom: "1px solid var(--line)" }}>
      <td style={{ padding: "12px", fontWeight: 600 }}>{label}</td>
      <td style={{ padding: "12px", color: "var(--muted)" }}>{spreadsheet}</td>
      <td style={{ padding: "12px", color: "var(--muted)" }}>{others}</td>
      <td style={{ padding: "12px", fontWeight: 600 }}>{marginsnap}</td>
    </tr>
  );
}
