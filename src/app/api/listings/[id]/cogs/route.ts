import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Sets the cost-of-goods for one listing (Blueprint workflow §2). Only ever
// affects future syncs' profit math — past order line items keep the cost
// that was in effect when they were synced (schema.prisma's note on
// OrderLineItem.cogsAtSale: "editing COGS later never rewrites history").
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cogsAmount = body?.cogsAmount;

  if (cogsAmount !== null && (typeof cogsAmount !== "number" || Number.isNaN(cogsAmount) || cogsAmount < 0)) {
    return NextResponse.json({ error: "cogsAmount must be a non-negative number, or null to clear it" }, { status: 400 });
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

  const updated = await prisma.listing.update({
    where: { id: params.id },
    data: { cogsAmount },
  });

  return NextResponse.json({ ok: true, id: updated.id, cogsAmount: updated.cogsAmount });
}
