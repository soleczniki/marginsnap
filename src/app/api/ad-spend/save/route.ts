import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Step 2 — the only route that actually writes AdSpendEntry rows. Called
// once the seller has reviewed and, where needed, corrected whatever
// /api/ad-spend/parse-paste or parse-screenshot came back with (see
// AdSpendImporter.tsx). Every row here is something the seller looked at
// and confirmed, but this still validates independently rather than
// trusting the client — same "don't rely on the frontend having checked"
// rule as the cogs route.
//
// Upserts on (listingId, periodStart, periodEnd) (2026-09-17, fixing a
// re-import footgun) rather than always inserting — re-pasting or
// re-screenshotting a report the seller already saved for this exact
// listing+period now corrects that entry's amount instead of quietly
// creating a second row that profitability.ts would sum on top of the
// first, silently doubling that listing's ad spend. Two different (even
// overlapping) periods for the same listing are still both kept, since
// that's the normal case for e.g. weekly imports inside one dashboard month.
const MAX_PERIOD_DAYS = 400; // generous — Etsy's own Ads stats page doesn't offer year-long ranges, this just guards against an obviously wrong date pair
const VALID_SOURCES = new Set(["paste", "screenshot", "manual"]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const periodStartStr: string | undefined = body?.periodStart;
  const periodEndStr: string | undefined = body?.periodEnd;
  const source: string | undefined = body?.source;
  const entries: unknown[] = Array.isArray(body?.entries) ? body.entries : [];

  if (!periodStartStr || !periodEndStr) {
    return NextResponse.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }
  if (!source || !VALID_SOURCES.has(source)) {
    return NextResponse.json({ error: "source must be 'paste', 'screenshot', or 'manual'" }, { status: 400 });
  }

  const periodStart = new Date(`${periodStartStr}T00:00:00.000Z`);
  const periodEnd = new Date(`${periodEndStr}T23:59:59.999Z`);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "couldn't read those dates" }, { status: 400 });
  }
  if (periodStart.getTime() > periodEnd.getTime()) {
    return NextResponse.json({ error: "the period's start date is after its end date" }, { status: 400 });
  }
  const spanDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > MAX_PERIOD_DAYS) {
    return NextResponse.json({ error: `that's a ${Math.round(spanDays)}-day period — double check the dates` }, { status: 400 });
  }
  // A day of slack past "now" — a seller in a timezone ahead of UTC pulling
  // "today"'s stats shouldn't get rejected for it.
  const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
  if (periodStart.getTime() > oneDayFromNow) {
    return NextResponse.json({ error: "that period starts in the future — check the dates" }, { status: 400 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "no rows to save" }, { status: 400 });
  }

  type RawEntry = { listingId?: unknown; amountSpent?: unknown; currency?: unknown };
  const cleaned: { listingId: string; amountSpent: number; currency: string | null }[] = [];
  for (const raw of entries as RawEntry[]) {
    const listingId = typeof raw.listingId === "string" ? raw.listingId : null;
    const amountSpent = typeof raw.amountSpent === "number" ? raw.amountSpent : Number(raw.amountSpent);
    if (!listingId || Number.isNaN(amountSpent) || amountSpent < 0) {
      return NextResponse.json({ error: "every row needs a listing and a non-negative amount" }, { status: 400 });
    }
    const currency = typeof raw.currency === "string" && raw.currency.length === 3 ? raw.currency.toUpperCase() : null;
    cleaned.push({ listingId, amountSpent, currency });
  }

  // Ownership check: every listingId must belong to a shop owned by this
  // user — otherwise a crafted request could write ad-spend rows onto
  // someone else's listing by guessing its id.
  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) return NextResponse.json({ error: "connect an Etsy shop first" }, { status: 400 });

  const ownedListingIds = new Set(
    (await prisma.listing.findMany({ where: { shopId: shop.id, id: { in: cleaned.map((c) => c.listingId) } }, select: { id: true } })).map(
      (l) => l.id
    )
  );
  const toSave = cleaned.filter((c) => ownedListingIds.has(c.listingId));
  const skippedCount = cleaned.length - toSave.length;
  if (toSave.length === 0) {
    return NextResponse.json({ error: "none of those rows matched a listing in this shop" }, { status: 400 });
  }

  // (listingId, periodStart, periodEnd) is now the unique key for one entry
  // (see schema.prisma), so two rows in the SAME save that landed on the
  // same listing (e.g. the seller manually picked one listing twice) are
  // combined here rather than the second silently overwriting the first
  // inside the upsert loop below.
  const combinedByListing = new Map<string, { amountSpent: number; currency: string | null }>();
  for (const c of toSave) {
    const prev = combinedByListing.get(c.listingId);
    combinedByListing.set(c.listingId, {
      amountSpent: (prev?.amountSpent ?? 0) + c.amountSpent,
      currency: prev?.currency ?? c.currency,
    });
  }
  const toUpsert = [...combinedByListing.entries()].map(([listingId, v]) => ({ listingId, ...v }));

  // Which of these (listing, period) keys already have an entry — used only
  // to tell the seller create vs. correct counts afterwards; the upsert
  // below is what actually prevents the duplicate regardless of this.
  const existing = await prisma.adSpendEntry.findMany({
    where: { periodStart, periodEnd, listingId: { in: toUpsert.map((c) => c.listingId) } },
    select: { listingId: true },
  });
  const alreadyHadEntry = new Set(existing.map((e) => e.listingId));

  await prisma.$transaction(
    toUpsert.map((c) =>
      prisma.adSpendEntry.upsert({
        where: { listingId_periodStart_periodEnd: { listingId: c.listingId, periodStart, periodEnd } },
        create: { listingId: c.listingId, periodStart, periodEnd, amountSpent: c.amountSpent, currency: c.currency, source },
        update: { amountSpent: c.amountSpent, currency: c.currency, source },
      })
    )
  );

  const updatedCount = toUpsert.filter((c) => alreadyHadEntry.has(c.listingId)).length;
  const createdCount = toUpsert.length - updatedCount;

  return NextResponse.json({ ok: true, savedCount: toUpsert.length, createdCount, updatedCount, skippedCount });
}
