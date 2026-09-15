import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// The fee-engine / profit-math inputs Etsy's API can't tell us — each sent
// one at a time from its own toggle on /dashboard/settings:
//   - sellerHasValidVatId (VatIdToggle) — see src/lib/sync.ts.
//   - assumeShippingNetZero (ShippingNetZeroToggle) — the shop-level
//     default for how shipping is treated in profit math; see
//     src/lib/profitability.ts's file header.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sellerHasValidVatId = body?.sellerHasValidVatId;
  const assumeShippingNetZero = body?.assumeShippingNetZero;

  if (sellerHasValidVatId === undefined && assumeShippingNetZero === undefined) {
    return NextResponse.json(
      { error: "sellerHasValidVatId or assumeShippingNetZero is required" },
      { status: 400 }
    );
  }
  if (sellerHasValidVatId !== undefined && typeof sellerHasValidVatId !== "boolean") {
    return NextResponse.json({ error: "sellerHasValidVatId must be true or false" }, { status: 400 });
  }
  if (assumeShippingNetZero !== undefined && typeof assumeShippingNetZero !== "boolean") {
    return NextResponse.json({ error: "assumeShippingNetZero must be true or false" }, { status: 400 });
  }

  // Ownership check — same pattern as listings/[id]/cogs: only this user's
  // own shop, never an id passed in from the client.
  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) {
    return NextResponse.json({ error: "no shop connected" }, { status: 404 });
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: {
      ...(sellerHasValidVatId !== undefined ? { sellerHasValidVatId } : {}),
      ...(assumeShippingNetZero !== undefined ? { assumeShippingNetZero } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    sellerHasValidVatId: updated.sellerHasValidVatId,
    assumeShippingNetZero: updated.assumeShippingNetZero,
  });
}
