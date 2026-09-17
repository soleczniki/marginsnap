import type { CogsEntry } from "@prisma/client";

// Shared logic for resolving a listing's cost-of-goods as of a given date,
// from its CogsEntry history (see schema.prisma's CogsEntry model for the
// full design). Pure function, no Prisma/fetch — same philosophy as
// profitability.ts, so it's trivially usable by both sync.ts (per order, at
// sync time) and the Manage Costs page (as of "now").

/** EARLIEST_SENTINEL is what "apply retroactively to every order" means
 * under the hood: an effectiveFrom old enough to predate every real order
 * MarginSnap will ever see, so "apply to everything" is just a normal
 * CogsEntry using the exact same lookup as every other mode — no special
 * case anywhere else in the codebase. */
export const EARLIEST_SENTINEL = new Date("1970-01-01T00:00:00.000Z");

/** The CogsEntry that was/is in effect on a given date — the one with the
 * latest effectiveFrom at or before that date, or null if no entry covers
 * it yet (same "add a cost to see profit" state as before this feature
 * existed). Ties on effectiveFrom (e.g. two entries both set to "today" —
 * the seller changed their mind twice in one day) break on createdAt, so
 * the most recently added entry always wins deterministically rather than
 * depending on array order. */
export function resolveCogsForDate(entries: CogsEntry[], date: Date): CogsEntry | null {
  let best: CogsEntry | null = null;
  for (const entry of entries) {
    if (entry.effectiveFrom.getTime() > date.getTime()) continue;
    if (!best) {
      best = entry;
      continue;
    }
    const isLater = entry.effectiveFrom.getTime() > best.effectiveFrom.getTime();
    const isTieButNewer =
      entry.effectiveFrom.getTime() === best.effectiveFrom.getTime() && entry.createdAt.getTime() > best.createdAt.getTime();
    if (isLater || isTieButNewer) best = entry;
  }
  return best;
}

/** The three Sellerboard-style modes for setting a new cost (Bogdan's
 * request, 2026-09-16) — see schema.prisma's CogsEntry comment. */
export type CogsMode = "today" | "all" | "date";

/** Turns a mode (+ a date string for "date") into the concrete effectiveFrom
 * to store on a new CogsEntry. Returns null only when mode is "date" and
 * dateStr is missing/unparsable — callers should treat that as a 400, never
 * silently fall back to some other date. */
export function effectiveFromForMode(mode: CogsMode, dateStr: string | undefined, now: Date = new Date()): Date | null {
  if (mode === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (mode === "all") return EARLIEST_SENTINEL;
  if (mode === "date") {
    if (!dateStr) return null;
    const parsed = new Date(`${dateStr}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
