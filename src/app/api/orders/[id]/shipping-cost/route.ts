import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Sets the seller's real postage cost for one order (PROJECT.md "shipping
// cost tracking"). Etsy's API has no field for this — see
// src/lib/profitability.ts's file header — so it's entered by hand, the
// same pattern as listings/[id]/cogs, but per-order rather than per-listing
// since postage cost varies order to order.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const shippingCostAtSale = body?.shippingCostAtSale;

  if (
    shippingCostAtSale !== null &&
    (typeof shippingCostAtSale !== "number" || Number.isNaN(shippingCostAtSale) || shippingCostAtSale < 0)
  ) {
    return NextResponse.json(
      { error: "shippingCostAtSale must be a non-negative number, or null to clear it" },
      { status: 400 }
    );
  }

  // Ownership check: the order must belong to a shop owned by this user —
  // same pattern as listings/[id]/cogs, one relation further up (order →
  // shop → user, rather than listing → shop → user).
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { shop: true },
  });

  if (!order || order.shop.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: { shippingCostAtSale },
  });

  return NextResponse.json({ ok: true, id: updated.id, shippingCostAtSale: updated.shippingCostAtSale });
}
