import type { CSSProperties } from "react";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin";
import { AdminHeader } from "@/components/AdminHeader";
import { FeedbackStatusSelect } from "@/components/FeedbackStatusSelect";
import { FeedbackNotes } from "@/components/FeedbackNotes";
import { Footer } from "@/components/Footer";
import { createDownloadUrls, type FeedbackAttachment } from "@/lib/feedbackStorage";

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  other: "Other",
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "new", label: "New" },
  { key: "planned", label: "Planned" },
  { key: "done", label: "Done" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const TYPE_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "bug", label: "Bugs" },
  { key: "feature", label: "Features" },
  { key: "other", label: "Other" },
];

function badgeStyle(bg: string, color: string): CSSProperties {
  return {
    display: "inline-block",
    background: bg,
    color,
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: "0.78rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

function typeBadge(type: string) {
  if (type === "bug") return badgeStyle("var(--loss-soft)", "var(--loss)");
  if (type === "feature") return badgeStyle("var(--accent-soft)", "var(--accent-ink)");
  return badgeStyle("var(--surface-2)", "var(--muted)");
}

function chipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "5px 11px",
    borderRadius: 999,
    fontSize: "0.85rem",
    border: "1px solid var(--line)",
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "#fff" : "var(--ink)",
    textDecoration: "none",
  };
}

function href(status: string, type: string): string {
  const params = new URLSearchParams();
  if (status !== "open") params.set("status", status);
  if (type !== "all") params.set("type", type);
  const q = params.toString();
  return q ? `/admin/feedback?${q}` : "/admin/feedback";
}

// Admin feedback list (2026-10-28): newest first, newest 200 for the chosen
// filter. Filter by status (default: Open = new + planned) and by type, set a
// status on each item, keep a private note, and see attached screenshots and
// videos (private storage, opened through one-hour signed links).
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: { status?: string; type?: string };
}) {
  await requireAdminPage();

  const status = STATUS_TABS.some((t) => t.key === searchParams.status) ? (searchParams.status as string) : "open";
  const type = TYPE_TABS.some((t) => t.key === searchParams.type) ? (searchParams.type as string) : "all";

  const where = {
    ...(status === "open" ? { status: { in: ["new", "planned"] } } : status === "all" ? {} : { status }),
    ...(type === "all" ? {} : { type }),
  };

  const [items, grouped] = await Promise.all([
    prisma.feedback.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: Record<string, number> = { new: 0, planned: 0, done: 0, dismissed: 0 };
  for (const g of grouped) counts[g.status] = g._count._all;
  const countFor = (key: string) =>
    key === "all"
      ? counts.new + counts.planned + counts.done + counts.dismissed
      : key === "open"
        ? counts.new + counts.planned
        : (counts[key] ?? 0);

  const attachmentsByItem = new Map<string, FeedbackAttachment[]>();
  const allPaths: string[] = [];
  for (const item of items) {
    const list = Array.isArray(item.attachments) ? (item.attachments as unknown as FeedbackAttachment[]) : [];
    attachmentsByItem.set(item.id, list);
    for (const a of list) allPaths.push(a.path);
  }
  const urls = await createDownloadUrls(allPaths, 60 * 60);

  return (
    <>
      <AdminHeader backHref="/admin" backLabel="← Back to admin" />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 80px" }}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: 12 }}>Feedback</h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {STATUS_TABS.map((t) => (
            <a key={t.key} href={href(t.key, type)} style={chipStyle(status === t.key)}>
              {t.label} ({countFor(t.key)})
            </a>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {TYPE_TABS.map((t) => (
            <a key={t.key} href={href(status, t.key)} style={chipStyle(type === t.key)}>
              {t.label}
            </a>
          ))}
        </div>

        {items.length === 0 && (
          <div className="card">
            <p style={{ color: "var(--muted)" }}>Nothing here.</p>
          </div>
        )}

        {items.map((item) => {
          const attachments = attachmentsByItem.get(item.id) ?? [];
          return (
            <div className="card" key={item.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={typeBadge(item.type)}>{TYPE_LABELS[item.type] ?? item.type}</span>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {item.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{item.email ?? "unknown"}</span>
                <span style={{ marginLeft: "auto" }}>
                  <FeedbackStatusSelect id={item.id} initial={item.status} />
                </span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{item.message}</p>

              {attachments.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                  {attachments.map((a) => {
                    const url = urls[a.path];
                    if (!url) {
                      return (
                        <span key={a.path} style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                          {a.name} (preview unavailable)
                        </span>
                      );
                    }
                    if (a.type.startsWith("video/")) {
                      return (
                        <div key={a.path}>
                          <video
                            src={url}
                            controls
                            preload="metadata"
                            style={{ maxWidth: 320, maxHeight: 220, borderRadius: 6, border: "1px solid var(--line)" }}
                          />
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{a.name}</div>
                        </div>
                      );
                    }
                    return (
                      <a key={a.path} href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={a.name}
                          style={{ maxWidth: 200, maxHeight: 150, borderRadius: 6, border: "1px solid var(--line)" }}
                        />
                      </a>
                    );
                  })}
                </div>
              )}

              {item.pageUrl && (
                <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: 8, marginBottom: 0 }}>
                  Page: {item.pageUrl}
                </p>
              )}

              <FeedbackNotes id={item.id} initial={item.notes ?? ""} />
            </div>
          );
        })}
      </main>
      <Footer />
    </>
  );
}
