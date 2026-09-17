import type { AppNotification } from "@/lib/notifications";

// Replaces the old single hardcoded "listings missing cost" card
// (2026-09-17) with a generic list — see src/lib/notifications.ts for why
// these are computed, not stored. Renders nothing at all when everything's
// fine, rather than a permanent "all good" card — once every notification
// here is actionable, an empty list should mean an empty panel.
export function NotificationsPanel({ notifications }: { notifications: AppNotification[] }) {
  if (notifications.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {notifications.map((n) => (
        <div
          key={n.id}
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span>{n.message}</span>
          <a href={n.ctaHref} className="button">
            {n.ctaLabel}
          </a>
        </div>
      ))}
    </div>
  );
}
