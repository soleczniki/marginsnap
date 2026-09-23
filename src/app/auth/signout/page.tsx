"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

// Custom-styled replacement for NextAuth's own unstyled sign-out
// confirmation page (2026-09-23 — it rendered with its own default theme,
// completely out of place next to the rest of the app). Wired in via
// authOptions.pages.signOut in src/lib/auth.ts. signOut() here needs no
// SessionProvider — it's a standalone helper that posts to
// /api/auth/signout (with CSRF token) itself, then redirects.
export default function SignOutPage() {
  const [signingOut, setSigningOut] = useState(false);

  function handleSignOut() {
    setSigningOut(true);
    signOut({ callbackUrl: "/" });
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.2rem", marginBottom: 8 }}>Sign out</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>Are you sure you want to sign out of MarginSnap?</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button type="button" className="button" disabled={signingOut} onClick={handleSignOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
        <a
          href="/dashboard"
          className="button"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        >
          Cancel
        </a>
      </div>
    </main>
  );
}
