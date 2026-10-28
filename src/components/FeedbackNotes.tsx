"use client";

import { useState } from "react";

// Admin-only private note on one feedback item. Never shown to the user.
export function FeedbackNotes({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save() {
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (!res.ok) throw new Error("failed");
      setSaved(value);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  const dirty = value !== saved;

  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        maxLength={4000}
        placeholder="Private note (only admins see this)"
        style={{
          width: "100%",
          padding: 8,
          borderRadius: 8,
          border: "1px dashed var(--line)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          font: "inherit",
          fontSize: "0.85rem",
          resize: "vertical",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
        <button type="button" className="button" disabled={!dirty || saving} onClick={save} style={{ padding: "4px 12px", fontSize: "0.8rem" }}>
          {saving ? "Saving..." : "Save note"}
        </button>
        {failed && <span style={{ color: "var(--loss)", fontSize: "0.8rem" }}>Failed to save</span>}
        {!dirty && !failed && saved && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Saved</span>}
      </div>
    </div>
  );
}
