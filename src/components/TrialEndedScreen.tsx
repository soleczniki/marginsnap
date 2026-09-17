// Shown instead of the dashboard once getBillingStatus says the free trial
// has ended and the user still isn't subscribed (2026-09-17). Nothing is
// deleted — every order, listing, and cost stays exactly as it was; this
// is purely a gate in front of it.
export function TrialEndedScreen() {
  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Your free trial has ended</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Your data is safe — nothing&rsquo;s been deleted. Subscribe for $9/mo to pick up right where you left off.
      </p>
      <a href="/api/stripe/checkout" className="button">
        Subscribe for $9/mo
      </a>
    </main>
  );
}
