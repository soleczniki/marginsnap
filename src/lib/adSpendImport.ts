// Ad spend import — the "paste from Etsy" half of the ad-spend feature
// (2026-09-17, Bogdan's request). Etsy has no ad-spend API endpoint and no
// documented CSV export for it (see the AdSpendEntry model comment in
// schema.prisma), so this parses whatever a seller copies straight off
// Etsy's own Ads stats page (Shop Manager > Marketing > Etsy Ads) and pastes
// into a plain textarea. Pure functions, no I/O — the screenshot path
// (adSpendVision.ts) converges on the exact same ParsedAdSpendRow /
// ParsedAdSpendResult shape so the review UI and the save route don't need
// to know which path a given row came from.
//
// IMPORTANT: nothing here is trusted on its own. Every row this produces is
// shown back to the seller on an editable review screen (listing picker +
// amount + period, all changeable) before anything is saved — see
// AdSpendImporter.tsx and /api/ad-spend/save. This file only has to get
// close enough to save typing, not be perfect.

export interface ParsedAdSpendRow {
  /** Whatever text sat in the "listing" column/area of the source — shown
   * to the seller as-is on the review screen even after a match is found,
   * so they can see what it matched against. */
  rawLabel: string;
  amountSpent: number;
  currency?: string | null;
}

export interface DetectedPeriod {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface ParsedAdSpendResult {
  rows: ParsedAdSpendRow[];
  detectedPeriod: DetectedPeriod | null;
  /** True when we found a header row and matched a "spend"-ish column by
   * name — the confident path. False means we fell back to "the one
   * money-shaped cell in each row," which is much more likely to have
   * picked up the wrong column (e.g. Sales instead of Spend) on a stats
   * table with more than one money column. The UI surfaces this so the
   * seller knows to double check amounts rather than just skimming them. */
  confidentColumnMatch: boolean;
}

const LABEL_HEADER_WORDS = ["listing", "title", "product", "item"];
const SPEND_HEADER_WORDS = ["spend", "amount spent", "ad spend", "cost"];
// Header words for columns we should recognize but NEVER mistake for spend
// (ROAS/CTR are ratios, not money, but "sales"/"revenue" are money-shaped
// and sit right next to Spend on Etsy's own table — excluding them by name
// is what keeps the no-header fallback below from grabbing the wrong cell
// when a header IS present but a column's number still looks moneyish).
const OTHER_MONEY_HEADER_WORDS = ["sales", "revenue", "orders", "value"];

const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits one line into cells — tabs first (the normal shape when Chrome
 * copies an HTML table), then runs of 2+ spaces (a plain-text table someone
 * retyped or a PDF export), then a plain comma as a last resort. */
function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((c) => c.trim());
  return line.split(",").map((c) => c.trim());
}

const MONEY_RE = /^[$€£]?\s*-?\d{1,3}(?:[,\s]?\d{3})*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|CAD|AUD)?$/i;

function parseMoneyCell(cell: string): { amount: number; currency?: string } | null {
  const trimmed = cell.trim();
  if (!trimmed || !MONEY_RE.test(trimmed)) return null;
  const symbolMatch = trimmed.match(/[$€£]/);
  const codeMatch = trimmed.match(/USD|EUR|GBP|CAD|AUD/i);
  const numeric = trimmed.replace(/[^0-9.-]/g, "");
  const amount = Number(numeric);
  if (Number.isNaN(amount)) return null;
  const currency = codeMatch ? codeMatch[0].toUpperCase() : symbolMatch ? CURRENCY_SYMBOL_TO_CODE[symbolMatch[0]] : undefined;
  return { amount, currency };
}

/** Looks for one of a handful of common date-range shapes anywhere in the
 * pasted text (Etsy's page header, if it got copied along with the table —
 * not guaranteed, hence this returning null being a normal, expected
 * outcome the review screen just asks the seller to fill in by hand). */
export function detectPeriod(rawText: string, now: Date = new Date()): DetectedPeriod | null {
  const year = now.getUTCFullYear();

  // "2026-09-01 - 2026-09-30" or "2026-09-01 to 2026-09-30"
  const isoRange = rawText.match(/(\d{4}-\d{2}-\d{2})\s*(?:-|to|–|—)\s*(\d{4}-\d{2}-\d{2})/);
  if (isoRange) return { start: isoRange[1], end: isoRange[2] };

  // "09/01/2026 - 09/30/2026" (assume MM/DD/YYYY — Etsy's own dashboard is US-formatted)
  const slashRange = rawText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:-|to|–|—)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashRange) {
    const [, m1, d1, y1, m2, d2, y2] = slashRange;
    return {
      start: `${y1}-${m1.padStart(2, "0")}-${d1.padStart(2, "0")}`,
      end: `${y2}-${m2.padStart(2, "0")}-${d2.padStart(2, "0")}`,
    };
  }

  // "Sep 1 - Sep 30, 2026" or "Sep 1, 2026 - Sep 30, 2026"
  const monthNames = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const wordRange = rawText.match(
    new RegExp(
      `(${monthNames})[a-z]*\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s*(?:-|to|–|—)\\s*(${monthNames})[a-z]*\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?`,
      "i"
    )
  );
  if (wordRange) {
    const [, mon1, day1, y1, mon2, day2, y2] = wordRange;
    const endYear = y2 ? Number(y2) : year;
    const startYear = y1 ? Number(y1) : endYear;
    const monthIndex = (name: string) => monthNames.split("|").findIndex((m) => m.toLowerCase() === name.toLowerCase());
    const toIso = (m: string, d: string, y: number) => `${y}-${String(monthIndex(m) + 1).padStart(2, "0")}-${d.padStart(2, "0")}`;
    return { start: toIso(mon1, day1, startYear), end: toIso(mon2, day2, endYear) };
  }

  return null;
}

/**
 * Parses pasted, tabular ad-stats text into rows. Never throws — an
 * unparsable paste just comes back with an empty `rows` array, and the
 * caller (the parse-paste API route) turns that into a friendly "couldn't
 * find any rows in that — try copying the whole table including its
 * headers" message rather than a 500.
 */
export function parsePastedAdSpend(rawText: string): ParsedAdSpendResult {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const detectedPeriod = detectPeriod(rawText);
  if (lines.length === 0) return { rows: [], detectedPeriod, confidentColumnMatch: false };

  const grid = lines.map(splitCells);

  // Look for a header row anywhere in the first couple of lines (some pastes
  // carry a page title or the date-range line above the real header).
  let headerRowIndex = -1;
  let labelColIndex = -1;
  let spendColIndex = -1;
  for (let i = 0; i < Math.min(grid.length, 3); i++) {
    const row = grid[i];
    const normalizedCells = row.map((c) => c.toLowerCase());
    const foundLabelCol = normalizedCells.findIndex((c) => LABEL_HEADER_WORDS.some((w) => c.includes(w)));
    const foundSpendCol = normalizedCells.findIndex((c) => SPEND_HEADER_WORDS.some((w) => c.includes(w)));
    if (foundSpendCol !== -1) {
      headerRowIndex = i;
      spendColIndex = foundSpendCol;
      labelColIndex = foundLabelCol !== -1 ? foundLabelCol : 0;
      break;
    }
  }

  const dataRows = headerRowIndex !== -1 ? grid.slice(headerRowIndex + 1) : grid;
  const rows: ParsedAdSpendRow[] = [];

  if (headerRowIndex !== -1) {
    for (const cells of dataRows) {
      if (cells.length <= spendColIndex) continue;
      const money = parseMoneyCell(cells[spendColIndex]);
      const label = cells[labelColIndex]?.trim();
      if (!money || !label) continue;
      rows.push({ rawLabel: label, amountSpent: money.amount, currency: money.currency ?? null });
    }
    return { rows, detectedPeriod, confidentColumnMatch: rows.length > 0 };
  }

  // No recognizable header — fall back to "first cell is the label, the one
  // money-shaped cell elsewhere in the row is the spend." When a row has
  // more than one money-shaped cell (e.g. Spend AND Sales, both formatted
  // as currency, with nothing to tell them apart by name) we take the FIRST
  // one, since Etsy's own table puts Spend to the left of Sales/Revenue —
  // but this is a guess, hence confidentColumnMatch: false, which the
  // review UI turns into an extra "double-check these amounts" note.
  for (const cells of dataRows) {
    if (cells.length < 2) continue;
    const label = cells[0]?.trim();
    if (!label) continue;
    const moneyCell = cells.slice(1).map(parseMoneyCell).find((m) => m !== null);
    if (!moneyCell) continue;
    rows.push({ rawLabel: label, amountSpent: moneyCell.amount, currency: moneyCell.currency ?? null });
  }

  return { rows, detectedPeriod, confidentColumnMatch: false };
}

export interface ListingForMatch {
  id: string;
  title: string;
}

export interface MatchResult {
  listingId: string;
  title: string;
  confidence: "high" | "low";
}

/** Matches one pasted/parsed row label against the shop's actual listings.
 * Etsy's Ads table sometimes truncates long titles with "…", so exact
 * matching alone would miss a lot — this tries progressively looser checks
 * and always returns the best candidate above a floor, never a forced
 * match. The review screen shows this as a preselected dropdown option that
 * the seller can change, not a silent auto-save. */
export function matchListingLabel(rawLabel: string, listings: ListingForMatch[]): MatchResult | null {
  const normalizedLabel = normalizeForMatch(rawLabel);
  if (!normalizedLabel) return null;

  for (const listing of listings) {
    if (normalizeForMatch(listing.title) === normalizedLabel) {
      return { listingId: listing.id, title: listing.title, confidence: "high" };
    }
  }

  for (const listing of listings) {
    const normalizedTitle = normalizeForMatch(listing.title);
    if (normalizedTitle.startsWith(normalizedLabel) || normalizedLabel.startsWith(normalizedTitle)) {
      return { listingId: listing.id, title: listing.title, confidence: "high" };
    }
  }

  const labelWords = new Set(normalizedLabel.split(" ").filter((w) => w.length > 2));
  let best: { listing: ListingForMatch; score: number } | null = null;
  for (const listing of listings) {
    const titleWords = new Set(normalizeForMatch(listing.title).split(" ").filter((w) => w.length > 2));
    if (titleWords.size === 0 || labelWords.size === 0) continue;
    const intersection = [...labelWords].filter((w) => titleWords.has(w)).length;
    const union = new Set([...labelWords, ...titleWords]).size;
    const score = intersection / union;
    if (!best || score > best.score) best = { listing, score };
  }

  if (best && best.score >= 0.5) {
    return { listingId: best.listing.id, title: best.listing.title, confidence: "low" };
  }

  return null;
}
