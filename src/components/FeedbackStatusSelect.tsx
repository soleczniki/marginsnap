"use client";

import { useState } from "react";

// Admin-only status dropdown for one feedback item. Saves on change.
export function FeedbackStatusSelect({ id, initial }: { id: string; initial: string }) {
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onChange(next: string) {
    const prev = status;
    setStatus(next);
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setStatus(prev);
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span>
      <select
        value={status}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: "0.85rem", padding: "4px 6px" }}
        aria-label="Feedback status"
      >
        <option value="new">New</option>
        <option value="planned">Planned</option>
        <option value="done">Done</option>
        <option value="dismissed">Dismissed</option>
      </select>
      {failed && <span style={{ color: "var(--loss)", fontSize: "0.8rem", marginLeft: 6 }}>Failed</span>}
    </span>
  );
}
