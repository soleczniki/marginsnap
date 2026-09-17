"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Intermediate "click to confirm sign-in" page (2026-09-17) — see
// src/lib/auth.ts's sendVerificationRequest comment for the full story.
// The real one-time NextAuth callback URL is passed through as ?u=... and
// is only ever navigated to from a genuine client-side click (requires JS
// execution) — a mail security scanner's passive link pre-fetch loads this
// page (harmless, consumes nothing) but never runs the click handler, so it
// can no longer burn the token before the real user clicks it themselves.
function ConfirmSignIn() {
  const params = useSearchParams();
  const target = params.get("u");
  const [clicked, setClicked] = useState(false);

  if (!target) {
    return (
      <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.2rem", marginBottom: 8 }}>Invalid sign-in link</h1>
        <p style={{ color: "var(--muted)" }}>
          This link is missing some information — go back to{" "}
          <a href="/" style={{ color: "var(--ink)" }}>
            marginsnap.app
          </a>{" "}
          and request a new one.
        </p>
      </main>
    );
  }

  function handleClick() {
    setClicked(true);
    window.location.href = target as string;
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: 8 }}>Confirm sign-in</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>
        Click below to finish signing in to MarginSnap.
      </p>
      <button type="button" className="button" onClick={handleClick} disabled={clicked}>
        {clicked ? "Signing in…" : "Sign in"}
      </button>
    </main>
  );
}

export default function ConfirmSignInPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmSignIn />
    </Suspense>
  );
}
