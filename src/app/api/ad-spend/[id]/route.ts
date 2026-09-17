import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Deletes one AdSpendEntry (2026-09-17, closing the "overlapping periods
// double-count" gap Bogdan flagged: paste a week, then later paste a month
// that already includes that week, and profitability.ts sums BOTH for any
// dashboard view spanning both — the exact-period upsert in .../save/route.ts
// only catches a re-import of the SAME period, not a differently-shaped one
// that happens to cover it). This route is how a seller resolves that: the
// review screen (AdSpendImporter) shows a "this new period overlaps an
// existing entry" warning with a delete button right there, and the
// "Recently added" list on the ad-spend page also offers it for cleanup
// after the fact. Same ownership-check pattern as every other per-resource
// route here — never trust an id alone.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const entry = await prisma.adSpendEntry.findUnique({
    where: { id: params.id },
    select: { id: true, listing: { select: { shop: { select: { userId: true } } } } },
  });
  if (!entry || entry.listing.shop.userId !== session.user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.adSpendEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
