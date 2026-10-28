"use client";

import { useState } from "react";

// Closed-beta waiting list form (2026-10-28). Used on the landing page and
// on the sign-in page when an unknown email is turned away. The hidden
// "website" input is a honeypot: real people never see or fill it.
export function WaitlistForm({
  id,
  title = "Join the waiting list",
  subtitle = "MarginSnap is in a small closed beta right now. Leave your email and we will invite you when a spot opens.",
  initialEmail = "",
  tight = false,
  bare = false,
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  initialEmail?: string;
  tight?: boolean;
  /** No page-level wrapper/heading, just the card (used inside SignInForm). */
  bare?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  const card =
    state === "done" ? (
      <div className="card">
        <p style={{ marginBottom: 8, fontWeight: 600 }}>You are on the list.</p>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>
          We will email you at {email.trim().toLowerCase()} when a spot opens. If you
          have feedback or questions meanwhile, write to hello@marginsnap.app.
        </p>
      </div>
    ) : (
      <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            style={{
              flex: "1 1 200px",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--ink)",
            }}
          />
          <button type="submit" className="button-accent" disabled={state === "sending"}>
            {state === "sending" ? "Joining..." : "Join waiting list"}
          </button>
        </div>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        {error && <p style={{ color: "var(--loss)", fontSize: "0.85rem", margin: 0 }}>{error}</p>}
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>
          We only use your email to tell you when a spot opens. See our <a href="/privacy">Privacy Policy</a>.
        </p>
      </form>
    );

  if (bare) return card;

  return (
    <main id={id} style={{ maxWidth: 420, margin: "0 auto", padding: tight ? "28px 24px 40px" : "56px 24px 40px" }}>
      <h1 style={{ fontSize: "1.6rem", marginBottom: 8 }}>{title}</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>{subtitle}</p>
      {card}
    </main>
  );
}
