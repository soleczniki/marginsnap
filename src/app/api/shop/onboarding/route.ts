import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Single endpoint for the onboarding wizard's three steps (2026-09-17,
// Bogdan's request) — VAT status, shipping net-zero assumption, and
// marking the wizard done. One route rather than three, since each step
// is just a partial update to the same Shop row; the body only ever
// carries the field(s) for whichever step just submitted.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sellerHasValidVatId: boolean | undefined = typeof body?.sellerHasValidVatId === "boolean" ? body.sellerHasValidVatId : undefined;
  const assumeShippingNetZero: boolean | undefined = typeof body?.assumeShippingNetZero === "boolean" ? body.assumeShippingNetZero : undefined;
  const complete: boolean = body?.complete === true;

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      ...(sellerHasValidVatId !== undefined ? { sellerHasValidVatId } : {}),
      ...(assumeShippingNetZero !== undefined ? { assumeShippingNetZero } : {}),
      ...(complete ? { onboardedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
