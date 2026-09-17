"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol } from "@/lib/money";

interface ListingOption {
  id: string;
  title: string;
}

interface ReviewRow {
  rawLabel: string;
  amountSpent: number;
  currency: string | null;
  listingId: string | null; // what the seller has selected right now — starts at the matched guess, editable
}

interface ParseResponse {
  rows: {
    rawLabel: string;
    amountSpent: number;
    currency: string | null;
    matchedListingId: string | null;
    matchedTitle: string | null;
    matchConfidence: "high" | "low" | null;
  }[];
  detectedPeriod: { start: string; end: string } | null;
  confidentColumnMatch: boolean;
}

// Ad spend import (2026-09-17, Bogdan's request) — two ways to get Etsy's
// own per-listing Ads spend numbers into MarginSnap without ever touching
// Etsy's site programmatically: paste the copied stats table as text, or
// upload/paste a screenshot of it. Both converge on the same review step
// below — nothing is saved until the seller confirms it here, since a
// misread number would otherwise silently distort profit. See
// schema.prisma's AdSpendEntry comment and src/lib/adSpendImport.ts /
// adSpendVision.ts for how each path gets to this same shape.
export function AdSpendImporter({ listings, currency }: { listings: ListingOption[]; currency: string | null }) {
  const [tab, setTab] = useState<"paste" | "screenshot">("paste");
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [confidentColumnMatch, setConfidentColumnMatch] = useState(true);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [source, setSource] = useState<"paste" | "screenshot">("paste");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function applyParseResponse(data: ParseResponse, sourceUsed: "paste" | "screenshot") {
    setRows(
      data.rows.map((r) => ({
        rawLabel: r.rawLabel,
        amountSpent: r.amountSpent,
        currency: r.currency,
        listingId: r.matchedListingId,
      }))
    );
    setConfidentColumnMatch(data.confidentColumnMatch);
    setSource(sourceUsed);
    if (data.detectedPeriod) {
      setPeriodStart(data.detectedPeriod.start);
      setPeriodEnd(data.detectedPeriod.end);
    }
    setSavedMessage(null);
  }

  async function handleParsePaste() {
    if (!pasteText.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await fetch("/api/ad-spend/parse-paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setParseError(data?.error ?? "couldn't read that — try again");
        return;
      }
      applyParseResponse(data, "paste");
    } finally {
      setParsing(false);
    }
  }

  async function handleImageFile(file: File) {
    setParsing(true);
    setParseError(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type ?? "image/png";

      const res = await fetch("/api/ad-spend/parse-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setParseError(data?.error ?? "couldn't read that screenshot — try again");
        return;
      }
      applyParseResponse(data, "screenshot");
    } finally {
      setParsing(false);
    }
  }

  function handlePasteImage(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    if (file) handleImageFile(file);
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  }

  function removeRow(index: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function addBlankRow() {
    setRows((prev) => [...(prev ?? []), { rawLabel: "(added manually)", amountSpent: 0, currency: null, listingId: null }]);
  }

  function resetImporter() {
    setRows(null);
    setPasteText("");
    setPeriodStart("");
    setPeriodEnd("");
  }

  async function handleSave() {
    if (!rows || rows.length === 0) return;
    if (!periodStart || !periodEnd) {
      alert("Enter the date range this report covers.");
      return;
    }
    const usableRows = rows.filter((r) => r.listingId && r.amountSpent >= 0);
    if (usableRows.length === 0) {
      alert("Pick a listing for at least one row before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ad-spend/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          source,
          entries: usableRows.map((r) => ({ listingId: r.listingId, amountSpent: r.amountSpent, currency: r.currency })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error ?? "couldn't save that — try again");
        return;
      }
      setSavedMessage(`Saved ad spend for ${data.savedCount} listing${data.savedCount === 1 ? "" : "s"}.`);
      resetImporter();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="button" style={{ opacity: tab === "paste" ? 1 : 0.55 }} onClick={() => setTab("paste")}>
          Paste from Etsy
        </button>
        <button
          type="button"
          className="button"
          style={{ opacity: tab === "screenshot" ? 1 : 0.55 }}
          onClick={() => setTab("screenshot")}
        >
          Upload a screenshot
        </button>
      </div>

      {tab === "paste" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
            On Etsy: Shop Manager → Marketing → Etsy Ads → Stats. Select the listings table (include the column headers) and copy
            it, then paste it below.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste the copied table here…"
            rows={6}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              fontFamily: "inherit",
              fontSize: "0.85rem",
            }}
          />
          <div>
            <button type="button" className="button" onClick={handleParsePaste} disabled={parsing || !pasteText.trim()}>
              {parsing ? "Reading…" : "Read this"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }} onPaste={handlePasteImage}>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
            On Etsy: Shop Manager → Marketing → Etsy Ads → Stats. Screenshot the listings table (make sure the Spend column and
            the date range are visible), then upload it below — or just paste it here (Ctrl/Cmd+V) if you copied it to your
            clipboard.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
            }}
          />
          <div
            tabIndex={0}
            style={{
              border: "1px dashed var(--line)",
              borderRadius: 8,
              padding: "16px",
              color: "var(--muted)",
              fontSize: "0.8rem",
              textAlign: "center",
            }}
          >
            Click here and paste (Ctrl/Cmd+V) a screenshot, or use the file picker above.
          </div>
          {parsing && <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Reading the screenshot…</span>}
        </div>
      )}

      {parseError && <p style={{ color: "var(--loss)", fontSize: "0.85rem", margin: 0 }}>{parseError}</p>}
      {savedMessage && <p style={{ color: "var(--profit-positive, green)", fontSize: "0.85rem", margin: 0 }}>{savedMessage}</p>}

      {rows && rows.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Check this before saving</div>
          {!confidentColumnMatch && (
            <p style={{ color: "var(--loss)", fontSize: "0.82rem", margin: 0 }}>
              Couldn&rsquo;t confidently tell which column was Spend — double-check the amounts below before saving.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Period:</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)" }}
            />
            <span style={{ color: "var(--muted)" }}>to</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)" }}
            />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--muted)" }}>From Etsy</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--muted)" }}>Matches which listing?</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--muted)" }}>Spend</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 8px", color: "var(--muted)" }}>{row.rawLabel}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <select
                        value={row.listingId ?? ""}
                        onChange={(e) => updateRow(i, { listingId: e.target.value || null })}
                        style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)", maxWidth: 220 }}
                      >
                        <option value="">— choose a listing —</option>
                        {listings.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <span style={{ color: "var(--muted)", marginRight: 4 }}>{currencySymbol(row.currency ?? currency)}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amountSpent}
                        onChange={(e) => updateRow(i, { amountSpent: Number(e.target.value) })}
                        style={{ width: 80, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink)" }}
                      />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button type="button" onClick={() => removeRow(i)} style={{ color: "var(--loss)", background: "none", border: "none", cursor: "pointer" }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" onClick={addBlankRow} style={{ fontSize: "0.82rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer" }}>
              + add a row
            </button>
          </div>

          <div>
            <button type="button" className="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save ad spend"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
