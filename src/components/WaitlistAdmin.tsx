"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin controls for the waiting list (2026-10-28): invite by email, and
// per-row invite / re-send / remove. All calls go to /api/admin/waitlist*,
// which check the admin session themselves.
export function WaitlistInviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error ?? "Failed.");
      } else {
        setMsg(data.emailSent ? "Invited, email sent." : "Marked as invited, but the email failed to send. Try Re-send.");
        setEmail("");
        router.refresh();
      }
    } catch {
      setMsg("Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tester@example.com"
        aria-label="Email to invite"
        style={{
          flex: "1 1 240px",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: "var(--surface-2)",
          color: "var(--ink)",
        }}
      />
      <button type="submit" className="button-accent" disabled={busy}>
        {busy ? "Inviting..." : "Invite by email"}
      </button>
      {msg && <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{msg}</span>}
    </form>
  );
}

export function WaitlistRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function call(method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !window.confirm("Remove this email from the waiting list?")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/waitlist/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PATCH" ? JSON.stringify({ action: "invite" }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(data?.error ?? "Failed.");
      else {
        if (method === "PATCH" && data.emailSent === false) setMsg("Email failed to send.");
        router.refresh();
      }
    } catch {
      setMsg("Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {status !== "joined" && (
        <button type="button" className="button-accent" disabled={busy} onClick={() => call("PATCH")} style={{ fontSize: "0.8rem", padding: "4px 10px" }}>
          {status === "invited" ? "Re-send" : "Invite"}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => call("DELETE")}
        style={{ fontSize: "0.8rem", padding: "4px 10px", background: "transparent", border: "1px solid var(--line)", borderRadius: 8, color: "var(--muted)", cursor: "pointer" }}
      >
        Remove
      </button>
      {msg && <span style={{ fontSize: "0.8rem", color: "var(--loss)" }}>{msg}</span>}
    </span>
  );
}
