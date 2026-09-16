import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Sets a listing's "typical shipping cost" default (Listing.defaultShippingCost)
// — never charged automatically, just what sync.ts seeds a NEW single-listing
// order's shippingCostAtSale with, and what the "apply to existing orders"
// button (apply-default-shipping-cost/route.ts) copies onto past orders on
// request. Mirrors listings/[id]/cogs exactly, same ownership-check pattern.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const defaultShippingCost = body?.defaultShippingCost;

  if (
    defaultShippingCost !== null &&
    (typeof defaultShippingCost !== "number" || Number.isNaN(defaultShippingCost) || defaultShippingCost < 0)
  ) {
    return NextResponse.json(
      { error: "defaultShippingCost must be a non-negative number, or null to clear it" },
      { status: 400 }
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id: params.id },
    include: { shop: true },
  });

  if (!listing || listing.shop.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: { defaultShippingCost },
  });

  return NextResponse.json({ ok: true, id: updated.id, defaultShippingCost: updated.defaultShippingCost });
}
