// Ad spend import — the "upload/paste a screenshot" half (2026-09-17,
// Bogdan's request), alongside the plain-text paste path in
// adSpendImport.ts. Calls the Anthropic API directly with `fetch` (no SDK
// dependency — one less package to keep in sync with package-lock.json,
// and this is the only call this app makes to it) to read a screenshot of
// Etsy's own Ads stats page and pull out the same {rows, period} shape the
// paste path produces, so the review screen and the save route don't care
// which path a row came from.
//
// Needs ANTHROPIC_API_KEY set in the environment (Vercel + local .env) —
// see PROJECT.md for the setup step. Without it, parseAdSpendScreenshot
// throws before making any network call, and the API route turns that into
// a clear "ad-spend screenshot import isn't configured yet" response
// instead of a confusing 500.
//
// Like the paste path, nothing this returns is trusted on its own: every
// row goes through the same editable review screen before anything is
// saved (see AdSpendImporter.tsx and /api/ad-spend/save) — this is reading
// numbers off a picture with a language model, which can misread a digit,
// so a human confirms before it becomes anyone's profit number.

import type { DetectedPeriod, ParsedAdSpendRow } from "@/lib/adSpendImport";

// Override with a different Claude model via ANTHROPIC_VISION_MODEL if this
// one is ever retired or a cheaper/better vision model becomes the better
// choice — check console.anthropic.com's model list rather than assuming
// this id stays current forever.
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export interface VisionParseResult {
  rows: ParsedAdSpendRow[];
  detectedPeriod: DetectedPeriod | null;
}

const PROMPT = `This is a screenshot of a seller's Etsy Ads stats page (Shop Manager > Marketing > Etsy Ads), showing ad spend per listing for some date range.

Extract ONLY:
1. The date range shown for this report, if one is visible anywhere in the image (a header, a dropdown, a label).
2. Each listing row that shows an actual spend/cost amount in money (a "Spend" or "Amount spent" column) — one entry per listing.

Do NOT include listings where you can't clearly read a spend amount. Do NOT invent numbers you can't actually see — if a digit is unclear, leave that row out entirely rather than guessing. Ignore columns like clicks, views, CTR, or ROAS — those are not money and must never be reported as amountSpent.

Reply with ONLY a JSON object, no other text, no markdown code fences, in exactly this shape:
{"period": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"} or null, "rows": [{"label": "<listing title as shown>", "amountSpent": <number>, "currency": "<ISO 4217 code if you can tell, else null>"}]}`;

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  throw new Error("Model reply didn't contain a JSON object");
}

export async function parseAdSpendScreenshot(imageBase64: string, mediaType: string): Promise<VisionParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const model = process.env.ANTHROPIC_VISION_MODEL || DEFAULT_MODEL;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Anthropic API error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const text: string | undefined = data?.content?.find((block: { type: string }) => block.type === "text")?.text;
  if (!text) throw new Error("Model reply had no text content");

  const parsed = JSON.parse(extractJsonObject(text));
  const rawRows: unknown[] = Array.isArray(parsed?.rows) ? parsed.rows : [];

  const rows: ParsedAdSpendRow[] = [];
  for (const r of rawRows) {
    const row = r as { label?: unknown; amountSpent?: unknown; currency?: unknown };
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const amountSpent = typeof row.amountSpent === "number" ? row.amountSpent : Number(row.amountSpent);
    if (!label || Number.isNaN(amountSpent) || amountSpent < 0) continue;
    const currency: string | null = typeof row.currency === "string" && row.currency.length === 3 ? row.currency.toUpperCase() : null;
    rows.push({ rawLabel: label, amountSpent, currency });
  }

  const period = parsed?.period;
  const detectedPeriod: DetectedPeriod | null =
    period && typeof period.start === "string" && typeof period.end === "string" ? { start: period.start, end: period.end } : null;

  return { rows, detectedPeriod };
}
