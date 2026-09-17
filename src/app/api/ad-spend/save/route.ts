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

  await prisma.adSpendEntry.createMany({
    data: toSave.map((c) => ({
      listingId: c.listingId,
      periodStart,
      periodEnd,
      amountSpent: c.amountSpent,
      currency: c.currency,
      source,
    })),
  });

  return NextResponse.json({ ok: true, savedCount: toSave.length, skippedCount });
}
