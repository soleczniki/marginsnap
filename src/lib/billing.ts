import type { User } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BillingStatus {
  isPaying: boolean;
  trialActive: boolean;
  trialExpired: boolean;
  /** Whole days left, rounded up (so "0.3 days left" reads as 1, not 0)
   * until midnight of the exact expiry moment — null when there's no
   * meaningful countdown (already paying, or grandfathered — see below). */
  daysLeft: number | null;
}

/** Single source of truth for "can this user use MarginSnap right now" —
 * every dashboard-area page calls this instead of re-deriving it (2026-09-17,
 * added alongside the free trial). Deliberately NOT Stripe's own trial
 * mechanism — no card is collected up front (Bogdan's call), so
 * User.trialEndsAt is our own 30-day clock, started the moment the account
 * was created (see auth.ts's events.createUser), independent of whether or
 * when they ever connect Etsy or check out.
 *
 * A null trialEndsAt means this account existed before trials were tracked
 * at all (in practice: just Bogdan's own account) — grandfathered in as
 * unrestricted forever, never gated, the same pattern as Shop.onboardedAt. */
export function getBillingStatus(user: Pick<User, "subscriptionStatus" | "trialEndsAt"> | null | undefined): BillingStatus {
  const isPaying = user?.subscriptionStatus === "active";
  if (isPaying) {
    return { isPaying: true, trialActive: false, trialExpired: false, daysLeft: null };
  }
  if (!user?.trialEndsAt) {
    return { isPaying: false, trialActive: true, trialExpired: false, daysLeft: null };
  }

  const daysLeft = Math.ceil((user.trialEndsAt.getTime() - Date.now()) / DAY_MS);
  return {
    isPaying: false,
    trialActive: daysLeft >= 0,
    trialExpired: daysLeft < 0,
    daysLeft,
  };
}
