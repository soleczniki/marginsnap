// A small, extensible notification system (2026-09-17, Bogdan's request) —
// deliberately NOT stored in the database. Every notification here is
// computed fresh on each page load from data we already have, because
// everything so far is a "is this still true right now" fact (a listing
// still has no cost, a trial is still ending soon) rather than a one-time
// announcement — so there's no read/unread state, no dismiss button, and
// no new table to keep in sync. If a genuine one-off announcement ("we
// shipped X") is ever needed, THAT would need real storage — this file is
// not the place for it.
export interface AppNotification {
  id: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
}

export function getNotifications(input: { listingsMissingCogsCount: number }): AppNotification[] {
  const notifications: AppNotification[] = [];

  if (input.listingsMissingCogsCount > 0) {
    const n = input.listingsMissingCogsCount;
    notifications.push({
      id: "missing-cogs",
      message: `${n} listing${n === 1 ? "" : "s"} still need${n === 1 ? "s" : ""} a cost set before ${n === 1 ? "its" : "their"} profit shows.`,
      ctaLabel: "Manage costs",
      ctaHref: "/dashboard/listings",
    });
  }

  return notifications;
}
