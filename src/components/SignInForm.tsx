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

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(LINK_LIFETIME_SECONDS);

  useEffect(() => {
    if (!sent || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
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
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "80px 24px" }}>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>MarginSnap</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>
        See what you actually made on that sale, in the time it takes to wrap the package.
      </p>

      {sent ? (
        <div className="card">
          {expired ? (
            <>
              <p style={{ marginBottom: 12 }}>
                That sign-in link has expired. Request a new one below.
              </p>
              <button type="button" className="button" onClick={requestNewLink}>
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
        <form onSubmit={handleSubmit} className="card" style={{ display: "flex", gap: 8 }}>
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
          <button type="submit" className="button">
            Sign in
          </button>
        </form>
      )}

      <p style={{ marginTop: 40, fontSize: "0.82rem", color: "var(--muted)" }}>
        <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </p>
    </main>
  );
}
