"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Grant/revoke /admin access for one user — only ever rendered for the
// superadmin (see admin pages), and the route this posts to checks that
// server-side again too (never trust client-side hiding alone for
// something this sensitive — see toggle-admin/route.ts).
export function AdminToggle({ userId, initialValue }: { userId: string; initialValue: boolean }) {
  const [isAdmin, setIsAdmin] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleClick() {
    const next = !isAdmin;
    const confirmed = next
      ? confirm("Grant admin access to this account? They'll be able to see every user's billing and shop data.")
      : confirm("Remove admin access for this account?");
    if (!confirmed) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: next }),
      });
      if (res.ok) {
        setIsAdmin(next);
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error ?? "Couldn't save that — try again in a moment.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      style={{
        background: "none",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: "0.8rem",
        color: isAdmin ? "var(--loss)" : "var(--accent-ink)",
        cursor: saving ? "default" : "pointer",
      }}
    >
      {saving ? "Saving…" : isAdmin ? "Remove admin" : "Make admin"}
    </button>
  );
}
