import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// The one fee-engine input Etsy's API can't tell us (checked the full Shop
// resource — no VAT/tax field exists anywhere in it): whether this shop's
// owner has a valid EU VAT ID on file with Etsy. Everything else the fee
// engine needs (sellerCountry) is synced automatically in src/lib/sync.ts —
// this is the one manual toggle, per shop, on /dashboard/settings.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sellerHasValidVatId = body?.sellerHasValidVatId;

  if (typeof sellerHasValidVatId !== "boolean") {
    return NextResponse.json({ error: "sellerHasValidVatId must be true or false" }, { status: 400 });
  }

  // Ownership check — same pattern as listings/[id]/cogs: only this user's
  // own shop, never an id passed in from the client.
  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) {
    return NextResponse.json({ error: "no shop connected" }, { status: 404 });
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: { sellerHasValidVatId },
  });

  return NextResponse.json({ ok: true, sellerHasValidVatId: updated.sellerHasValidVatId });
}
