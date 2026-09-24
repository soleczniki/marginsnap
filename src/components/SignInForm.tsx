"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

// The actual "enter your email" form — split out of src/app/page.tsx
// (2026-09-16) so that file could become a server component that checks for
// an existing session first. This component's content/behavior is otherwise
// unchanged from before that split.
//
// LINK_LIFETIME_SECONDS must match the EmailProvider's `maxAge` in src/lib/auth.ts
// — this is just the countdown display, not what actually expires the link.
const LINK_LIFETIME_SECONDS = 60 * 5;

export function SignInForm({
  title = "MarginSnap",
  subtitle = "See what you actually made on that sale, in the time it takes to wrap the package.",
  id,
  showLegalLinks = true,
  showTermsCheckbox = true,
}: {
  /** Overridable so the landing page (2026-09-17) can reuse this exact form
   * — same email/magic-link mechanics, no separate signup flow to build —
   * with its own heading instead of the bare wordmark. */
  title?: string;
  subtitle?: string;
  /** Anchor id, so a page embedding this more than once (or linking to it
   * from a nav CTA) has something to scroll to. */
  id?: string;
  /** LandingPage.tsx already has its own Privacy/Terms footer right below
   * this form (2026-09-17 fix — they were showing up twice) — it passes
   * false here. Defaults to true so this form still stands on its own if
   * anything ever embeds it without a footer of its own. */
  showLegalLinks?: boolean;
  /** Defaults to true (the landing page's signup form — a first-time
   * visitor genuinely needs to agree before an account is created).
   * src/app/auth/signin/page.tsx (2026-09-24, Bogdan's request for a real
   * dedicated sign-in page reachable from the nav) passes false: a
   * returning user re-checking a box they already agreed to on signup read
   * as pointless friction. This still can't truly tell signup from sign-in
   * before the email's submitted (same underlying limitation noted below —
   * see PROJECT.md's "Separate sign-up from sign-in" backlog item for the
   * fuller fix), so the dedicated sign-in page shows the same Terms/Privacy
   * links as plain disclosure text instead of a required checkbox, rather
   * than silently dropping the disclosure altogether. */
  showTermsCheckbox?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(LINK_LIFETIME_SECONDS);

  useEffect(() => {
    if (!sent || secondsLeft <= 0) return;
    const intervalId = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(intervalId);
  }, [sent, secondsLeft]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn("email", { email, redirect: false, callbackUrl: "/dashboard" });
    setSecondsLeft(LINK_LIFETIME_SECONDS);
    setSent(true);
  }

  function requestNewLink() {
    setSent(false);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const expired = secondsLeft <= 0;

  return (
    <main id={id} style={{ maxWidth: 420, margin: "0 auto", padding: "80px 24px" }}>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>{title}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>{subtitle}</p>

      {sent ? (
        <div className="card">
          {expired ? (
            <>
              <p style={{ marginBottom: 12 }}>
                That sign-in link has expired. Request a new one below.
              </p>
              <button type="button" className="button-accent" onClick={requestNewLink}>
                Request a new sign-in link
              </button>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 8 }}>Check your email for a sign-in link.</p>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                Expires in {minutes}:{seconds.toString().padStart(2, "0")}
              </p>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface-2)",
                color: "var(--ink)",
              }}
            />
            <button type="submit" className="button-accent">
              Sign in
            </button>
          </div>
          {/* Required (2026-09-17, Bogdan's request) — same form serves both
             signup and sign-in (there's no way to tell which before the
             email is submitted), so this shows every time this form is used
             as the SIGNUP entry point rather than only on a first-ever
             signup. A plain HTML `required` checkbox is enough: the browser
             blocks submission natively until it's checked, no extra state
             needed here. showTermsCheckbox={false} (the dedicated sign-in
             page, 2026-09-24) swaps this for plain non-blocking text below
             instead — a returning user shouldn't have to re-click "I agree"
             every time they sign in. */}
          {showTermsCheckbox ? (
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: "0.8rem",
                color: "var(--muted)",
              }}
            >
              <input type="checkbox" required style={{ marginTop: 3 }} />
              <span>
                I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
              </span>
            </label>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
              By continuing you agree to our <a href="/terms">Terms</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </p>
          )}
        </form>
      )}

      {showLegalLinks && (
        <p style={{ marginTop: 40, fontSize: "0.82rem", color: "var(--muted)" }}>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </p>
      )}
    </main>
  );
}
