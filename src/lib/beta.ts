import { prisma } from "./db";

// Closed beta switch (2026-10-28, automatic version).
//
// Etsy's Personal Access allows at most 5 connected shops (the owner's
// included) until Commercial Access is approved (stated by Etsy support,
// ticket #27197730). So sign-ups are open until the 5 spots are taken, then
// the site switches itself to "beta full": visitors join the waiting list
// and an admin invites them from /admin/waitlist. Existing accounts can
// always sign in, and invited emails can always sign up.
//
// A spot is taken by: a connected Etsy shop, OR a sign-up (non-admin, trial
// still running) that has not connected a shop yet, OR an invitation that
// has not been used yet. Counting only connected shops would let several
// people sign up before any of them connects, and the 6th connection would
// fail at Etsy.
//
// Env SIGNUPS_OPEN overrides the automatic rule: "true" = always open (ignore
// the limit), "false" = always closed, unset/empty = automatic.
export const ETSY_PERSONAL_SHOP_LIMIT = 5;

export type BetaStatus = {
  closed: boolean;
  mode: "auto" | "forced-open" | "forced-closed";
  limit: number;
  connectedShops: number;
  pendingSignups: number;
  openInvites: number;
  taken: number;
};

export async function getBetaStatus(): Promise<BetaStatus> {
  const flag = (process.env.SIGNUPS_OPEN ?? "").trim().toLowerCase();
  const mode = flag === "true" ? "forced-open" : flag === "false" ? "forced-closed" : "auto";
  const limit = ETSY_PERSONAL_SHOP_LIMIT;

  try {
    // Imported lazily: admin.ts imports auth.ts, which imports this file.
    const { SUPERADMIN_EMAIL } = await import("./admin");
    const [connectedShops, pendingSignups, openInvites] = await Promise.all([
      prisma.shop.count({ where: { accessTokenEnc: { not: null } } }),
      prisma.user.count({
        where: {
          isAdmin: false,
          email: { not: SUPERADMIN_EMAIL },
          trialEndsAt: { gt: new Date() },
          shops: { none: { accessTokenEnc: { not: null } } },
        },
      }),
      prisma.waitlistEntry.count({ where: { status: "invited" } }),
    ]);
    const taken = connectedShops + pendingSignups + openInvites;
    const closed = mode === "forced-open" ? false : mode === "forced-closed" ? true : taken >= limit;
    return { closed, mode, limit, connectedShops, pendingSignups, openInvites, taken };
  } catch (err) {
    // If the database cannot be read, fail closed (the safe side of the
    // Etsy limit) unless open was forced.
    console.error("getBetaStatus failed:", err);
    return {
      closed: mode !== "forced-open",
      mode,
      limit,
      connectedShops: 0,
      pendingSignups: 0,
      openInvites: 0,
      taken: 0,
    };
  }
}

export async function isBetaClosed(): Promise<boolean> {
  return (await getBetaStatus()).closed;
}
