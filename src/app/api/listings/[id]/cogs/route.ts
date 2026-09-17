import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { effectiveFromForMode, resolveCogsForDate, type CogsMode } from "@/lib/cogs";

// Sets a listing's cost of goods (Blueprint workflow §2). As of 2026-09-16
// this always creates a new CogsEntry rather than overwriting a single
// value — see schema.prisma's CogsEntry model for the full design. `mode`
// picks the entry's effectiveFrom:
//   - "today": can never affect an already-synced order (its date is
//     necessarily in the past) — no confirmation needed, matches the old
//     "only affects orders synced from now on" promise exactly.
//   - "all" / "date": CAN cover already-synced orders, so the caller must
//     have shown the seller the affected count first (GET
//     .../cogs/affected-count) and gotten an explicit "yes, overwrite them" —
//     `confirmed: true` is required in the body for these two modes, and
//     enforced here too, not just left to the frontend, since this is the
//     one action in the app that can genuinely overwrite an
//     already-computed value rather than just fill in a gap.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cogsAmount = body?.cogsAmount;
  const mode: CogsMode | undefined = body?.mode;
  const dateStr: string | undefined = body?.date;
  const confirmed: boolean = body?.confirmed === true;

  if (typeof cogsAmount !== "number" || Number.isNaN(cogsAmount) || cogsAmount < 0) {
    return NextResponse.json({ error: "cogsAmount must be a non-negative number" }, { status: 400 });
  }
  if (mode !== "today" && mode !== "all" && mode !== "date") {
    return NextResponse.json({ error: "mode must be 'today', 'all', or 'date'" }, { status: 400 });
  }

  const effectiveFrom = effectiveFromForMode(mode, dateStr);
  if (!effectiveFrom) {
    return NextResponse.json({ error: "a valid date is required for mode 'date'" }, { status: 400 });
  }

  if (mode !== "today" && !confirmed) {
    return NextResponse.json(
      { error: "this mode can overwrite already-synced orders — confirm first (see .../affected-count)" },
      { status: 400 }
    );
  }

  // Ownership check: the listing must belong to a shop owned by this user —
  // otherwise anyone could set costs on anyone else's listing by guessing IDs.
  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { shop: true },
  });
  if (!listing || listing.shop.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.cogsEntry.create({
    data: { listingId: listing.id, cogsAmount, effectiveFrom },
  });

  // "today" mode's effectiveFrom is always today or later relative to every
  // already-synced order's date, so recomputing would be a guaranteed no-op
  // — skipped entirely rather than run and report 0, to keep this fast.
  const recomputedCount = mode !== "today" ? await recomputeCogsForListing(listing.id, effectiveFrom) : 0;

  return NextResponse.json({ ok: true, cogsAmount, effectiveFrom: effectiveFrom.toISOString(), recomputedCount });
}

/** Recomputes cogsAtSale/lineProfit for every already-synced line item of
 * this listing whose order is on or after sinceDate — the explicit,
 * confirmed counterpart to sync.ts's per-order resolution at sync time.
 * Some of these may resolve to the same value they already had (a later,
 * more specific entry might still "win" for a given order) — recomputing
 * them anyway is harmless and much simpler than pre-filtering for an actual
 * change. */
async function recomputeCogsForListing(listingId: string, sinceDate: Date): Promise<number> {
  const [entries, lineItems] = await Promise.all([
    prisma.cogsEntry.findMany({ where: { listingId } }),
    prisma.orderLineItem.findMany({
      where: { listingId, order: { orderDate: { gte: sinceDate } } },
      include: { order: true },
    }),
  ]);

  for (const li of lineItems) {
    const entry = resolveCogsForDate(entries, li.order.orderDate);
    const cogsAtSale = entry ? Number(entry.cogsAmount) : null;
    const lineProfit = cogsAtSale !== null ? Number(li.unitPrice) - cogsAtSale : null;
    await prisma.orderLineItem.update({
      where: { id: li.id },
      data: { cogsAtSale, lineProfit },
    });
  }

  return lineItems.length;
}
