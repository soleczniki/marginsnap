"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FeedbackForm } from "@/components/FeedbackForm";

// Floating "Feedback" button (2026-10-28, Bogdan's request): visible on
// every signed-in page (it is mounted from the dashboard and admin layouts),
// opens the feedback form in a popup so nobody has to leave what they are
// doing. The page they were on is attached to the report automatically.
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The standalone feedback page already is the form.
  if (pathname?.startsWith("/dashboard/feedback")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 50,
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "10px 16px",
          fontSize: "0.9rem",
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxWidth: 520,
              maxHeight: "100%",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Send feedback</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
            <FeedbackForm embedded pageUrl={pathname ?? ""} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
