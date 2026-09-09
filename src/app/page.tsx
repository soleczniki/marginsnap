"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

// Landing + sign-in in one screen — magic link only, no password to build or
// reset (Blueprint decision). Real landing-page copy/design is a Phase 5 task
// ("stand up a simple marketing page"); this is intentionally plain.
export default function Home() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn("email", { email, redirect: false, callbackUrl: "/dashboard" });
    setSent(true);
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "80px 24px" }}>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>MarginSnap</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>
        See what you actually made on that sale, in the time it takes to wrap the package.
      </p>

      {sent ? (
        <div className="card">Check your email for a sign-in link.</div>
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
