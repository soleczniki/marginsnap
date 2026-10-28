"use client";

import { useRef, useState } from "react";

// Feedback form (2026-10-28), used both on /dashboard/feedback and inside
// the floating Feedback button's popup. Posts to /api/feedback. Up to 3
// screenshots/videos (25 MB each) can be attached: each goes straight to
// private storage through a signed upload URL (see
// src/lib/feedbackStorage.ts), then only the file paths are sent along with
// the message. Images can also be pasted into the text box.
const TYPES = [
  { value: "bug", label: "Something is broken" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Something else" },
];

const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm", "video/quicktime"];
const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;

type Uploaded = { path: string; name: string; type: string; size: number };

function formatSize(n: number): string {
  return n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function FeedbackForm({
  pageUrl,
  embedded,
  onClose,
}: {
  pageUrl?: string;
  embedded?: boolean;
  onClose?: () => void;
}) {
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function addFiles(list: File[]) {
    const next = [...files];
    let problem: string | null = null;
    for (const f of list) {
      if (!ALLOWED.includes(f.type)) {
        problem = `"${f.name}" is not a supported file. Use PNG, JPG, GIF, WebP, MP4, WebM or MOV.`;
        continue;
      }
      if (f.size > MAX_BYTES) {
        problem = `"${f.name}" is larger than 25 MB.`;
        continue;
      }
      if (next.length >= MAX_FILES) {
        problem = `You can attach up to ${MAX_FILES} files.`;
        break;
      }
      next.push(f);
    }
    setFiles(next);
    setError(problem);
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
    setError(null);
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (pasted.length > 0) {
      e.preventDefault();
      addFiles(pasted);
    }
  }

  async function uploadAll(): Promise<Uploaded[]> {
    const uploaded: Uploaded[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgress(`Uploading file ${i + 1} of ${files.length}...`);
      const r = await fetch("/api/feedback/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: f.name, contentType: f.type, size: f.size }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(`${d?.error ?? "Could not upload the file."}${d?.detail ? ` [${d.detail}]` : ""}`);
      const fd = new FormData();
      fd.append("cacheControl", "3600");
      fd.append("", f);
      const up = await fetch(d.uploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: fd });
      if (!up.ok) throw new Error(`Uploading "${f.name}" failed. Please try again.`);
      uploaded.push({ path: d.path, name: f.name, type: f.type, size: f.size });
    }
    return uploaded;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) {
      setError("Please write a little more.");
      return;
    }
    setState("sending");
    setError(null);

    let page = pageUrl ?? "";
    if (!page) {
      try {
        const ref = document.referrer;
        if (ref && new URL(ref).origin === window.location.origin) page = new URL(ref).pathname;
      } catch {
        // no usable referrer - the page is simply left out
      }
    }

    try {
      const attachments = files.length > 0 ? await uploadAll() : [];
      setProgress("Sending...");
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, pageUrl: page, attachments }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Something went wrong.");
      }
      setState("sent");
      setMessage("");
      setFiles([]);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
      setState("idle");
    }
  }

  const wrapperClass = embedded ? undefined : "card";

  if (state === "sent") {
    return (
      <div className={wrapperClass}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Thank you - we got it.</div>
        <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 12 }}>
          We read every message. If we need more detail we will email you.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="button" onClick={() => setState("idle")}>
            Send another
          </button>
          {onClose && (
            <button type="button" className="button" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={wrapperClass}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {TYPES.map((t) => (
          <label
            key={t.value}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: type === t.value ? "var(--accent-soft)" : "var(--surface)",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            <input type="radio" name="feedback-type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} />
            {t.label}
          </label>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onPaste={handlePaste}
        rows={embedded ? 5 : 7}
        maxLength={4000}
        placeholder={
          type === "bug"
            ? "What happened, and what did you expect to happen?"
            : type === "feature"
              ? "What would you like MarginSnap to do?"
              : "Tell us anything."
        }
        style={{
          width: "100%",
          padding: 10,
          borderRadius: 8,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          font: "inherit",
          resize: "vertical",
        }}
      />

      <div style={{ marginTop: 10 }}>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ALLOWED.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="button"
          style={{ background: "none", color: "var(--ink)", border: "1px solid var(--line)" }}
          disabled={state === "sending" || files.length >= MAX_FILES}
          onClick={() => fileInput.current?.click()}
        >
          Attach screenshot or video
        </button>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem", marginLeft: 8 }}>
          Up to {MAX_FILES} files, 25 MB each. You can also paste an image.
        </span>

        {files.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", marginBottom: 4 }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                  {f.type.startsWith("video/") ? "Video: " : "Image: "}
                  {f.name}
                </span>
                <span style={{ color: "var(--muted)" }}>{formatSize(f.size)}</span>
                {state !== "sending" && (
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.name}`}
                    style={{ background: "none", border: "none", color: "var(--loss)", cursor: "pointer", fontSize: "0.85rem" }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <div style={{ color: "var(--loss)", fontSize: "0.85rem", marginTop: 8 }}>{error}</div>}

      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className="button" disabled={state === "sending"}>
          {state === "sending" ? "Sending..." : "Send feedback"}
        </button>
        {state === "sending" && progress && <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{progress}</span>}
      </div>
    </form>
  );
}
