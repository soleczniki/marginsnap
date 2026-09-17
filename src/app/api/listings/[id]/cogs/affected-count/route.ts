import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { effectiveFromForMode, type CogsMode } from "@/lib/cogs";

// Dry-run for the cost-of-goods "apply retroactively"/"apply from a date"
// confirmation warning (Bogdan's request, 2026-09-16): how many
// already-synced order line items would this new cost entry recompute, so
// CogsEditor can show "this will overwrite the cost of goods for N orders
// that are already synced... this can't be undone" BEFORE the seller
// confirms, in POST .../cogs's `confirmed` flag. Read-only — never writes.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") as CogsMode | null;
  const dateStr = url.searchParams.get("date") ?? undefined;

  if (mode !== "today" && mode !== "all" && mode !== "date") {
    return NextResponse.json({ error: "mode must be 'today', 'all', or 'date'" }, { status: 400 });
  }

  const effectiveFrom = effectiveFromForMode(mode, dateStr);
  if (!effectiveFrom) {
    return NextResponse.json({ error: "a valid date is required for mode 'date'" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { shop: true },
  });
  if (!listing || listing.shop.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (mode === "today") {
    // Never touches already-synced orders by definition — see the POST
    // route's comment.
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.orderLineItem.count({
    where: { listingId: listing.id, order: { orderDate: { gte: effectiveFrom } } },
  });

  return NextResponse.json({ count });
}
