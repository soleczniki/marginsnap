import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// One-click backfill: copies a listing's defaultShippingCost onto EXISTING
// orders that don't have a real shipping cost entered yet — the button next
// to DefaultShippingCostEditor on the "Manage costs" page. Only ever
// touches orders that are still unset (never overwrites a cost the seller
// already entered by hand, real or corrected), and only single-listing
// orders for this exact listing — same safety rule sync.ts uses when
// seeding new orders, so a multi-product order is never guessed at here
// either. See src/lib/profitability.ts and PROJECT.md.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { shop: true },
  });

  if (!listing || listing.shop.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (listing.defaultShippingCost === null) {
    return NextResponse.json(
      { error: "set a default shipping cost for this listing first" },
      { status: 400 }
    );
  }

  // Orders in this shop that still have no shipping cost entered, whose
  // line items are ALL for this one listing (a multi-product order is left
  // alone — combining two different defaults into one package cost isn't a
  // safe guess).
  const candidates = await prisma.order.findMany({
    where: { shopId: listing.shopId, shippingCostAtSale: null },
    include: { lineItems: true },
  });
  const targetOrderIds = candidates
    .filter((o) => o.lineItems.length > 0 && o.lineItems.every((li) => li.listingId === listing.id))
    .map((o) => o.id);

  if (targetOrderIds.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: targetOrderIds } },
      data: { shippingCostAtSale: listing.defaultShippingCost },
    });
  }

  return NextResponse.json({ ok: true, updatedCount: targetOrderIds.length });
}
