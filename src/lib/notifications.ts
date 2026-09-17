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

export function getNotifications(input: {
  listingsMissingCogsCount: number;
  /** Days left in the free trial, or null when there's nothing to count
   * down (already paying, or grandfathered — see src/lib/billing.ts).
   * Trial-ended itself isn't a notification — TrialEndedScreen replaces
   * the whole dashboard by then, so this only ever fires while trialActive. */
  trialDaysLeft?: number | null;
}): AppNotification[] {
  const notifications: AppNotification[] = [];

  if (input.trialDaysLeft !== null && input.trialDaysLeft !== undefined && input.trialDaysLeft >= 0) {
    const d = input.trialDaysLeft;
    notifications.push({
      id: "trial-countdown",
      message: d === 0 ? "Your free trial ends today." : `${d} day${d === 1 ? "" : "s"} left in your free trial.`,
      ctaLabel: "Subscribe — $9/mo",
      ctaHref: "/api/stripe/checkout",
    });
  }

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
