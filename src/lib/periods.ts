// Period picker for the dashboard — Phase 2 of PROJECT.md's roadmap ("pick a
// period, see real profit per order and per product"). Deliberately a fixed
// short list, not a free-form date-range picker, for v1: a solo seller's
// natural questions are "how am I doing lately" at a few common
// granularities, not arbitrary custom ranges.
//
// Day grouping (in profitability.ts) uses the UTC calendar day, not the
// seller's local timezone — Etsy's Shop resource doesn't expose a timezone
// field (checked the same way sellerCountry was confirmed), so there's no
// real per-shop value to source this from yet. Documented as a known
// simplification, not a hardcoded assumption about where any given seller
// is.

export type PeriodKey = "7d" | "30d" | "mtd" | "all";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "mtd", label: "This month" },
  { key: "all", label: "All time" },
];

export function isPeriodKey(value: string | undefined): value is PeriodKey {
  return PERIODS.some((p) => p.key === value);
}

/** `start: null` means "no lower bound" (the "all" period). */
export function periodRange(key: PeriodKey, now: Date = new Date()): { start: Date | null; end: Date } {
  const end = now;
  switch (key) {
    case "7d": {
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 7);
      return { start, end };
    }
    case "30d": {
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 30);
      return { start, end };
    }
    case "mtd":
      return { start: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)), end };
    case "all":
    default:
      return { start: null, end };
  }
}
