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

// "custom" (2026-09-16 request, CustomDatePicker.tsx) is deliberately NOT in
// the PERIODS list below — it isn't one button among these, it's driven by
// explicit start/end query params instead. isPeriodKey/periodRange both
// still need to recognize it, though.
export type PeriodKey = "7d" | "30d" | "mtd" | "all" | "custom";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "mtd", label: "This month" },
  { key: "all", label: "All time" },
];

export function isPeriodKey(value: string | undefined): value is PeriodKey {
  return PERIODS.some((p) => p.key === value) || value === "custom";
}

/** `start: null` means "no lower bound" (the "all" period, or "custom"
 * called without a valid range — dashboard/page.tsx is expected to fall
 * back to a fixed preset before that happens, but this stays a safe default
 * rather than throwing). */
export function periodRange(
  key: PeriodKey,
  now: Date = new Date(),
  /** Only read when key is "custom" — the validated {start, end} from the
   * CustomDatePicker's start/end query params (dashboard/page.tsx parses
   * and validates those, this function never touches strings itself). */
  custom?: { start: Date; end: Date }
): { start: Date | null; end: Date } {
  switch (key) {
    case "7d": {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 7);
      return { start, end: now };
    }
    case "30d": {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 30);
      return { start, end: now };
    }
    case "mtd":
      return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: now };
    case "custom":
      return custom ? { start: custom.start, end: custom.end } : { start: null, end: now };
    case "all":
    default:
      return { start: null, end: now };
  }
}

/** YYYY-MM-DD in UTC, for prefilling/round-tripping the CustomDatePicker's
 * <input type="date"> values — matches the UTC-calendar-day convention this
 * file already documents for day grouping. */
export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}
