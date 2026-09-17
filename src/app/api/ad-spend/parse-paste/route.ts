import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePastedAdSpend, matchListingLabel } from "@/lib/adSpendImport";

// Step 1 of the "paste from Etsy" ad-spend import (2026-09-17) — parses
// whatever text the seller pasted and matches each row against their own
// listings, but saves NOTHING. The frontend (AdSpendImporter.tsx) shows the
// result as an editable review table; only a separate, explicit call to
// /api/ad-spend/save actually writes anything. See schema.prisma's
// AdSpendEntry comment for why that split matters here.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text: string | undefined = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "paste some text first" }, { status: 400 });
  }

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) return NextResponse.json({ error: "connect an Etsy shop first" }, { status: 400 });

  const listings = await prisma.listing.findMany({ where: { shopId: shop.id }, select: { id: true, title: true } });

  const { rows, detectedPeriod, confidentColumnMatch } = parsePastedAdSpend(text);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "couldn't find any rows in that — try copying the whole table, including its column headers" },
      { status: 400 }
    );
  }

  const matchedRows = rows.map((row) => {
    const match = matchListingLabel(row.rawLabel, listings);
    return {
      rawLabel: row.rawLabel,
      amountSpent: row.amountSpent,
      currency: row.currency ?? null,
      matchedListingId: match?.listingId ?? null,
      matchedTitle: match?.title ?? null,
      matchConfidence: match?.confidence ?? null,
    };
  });

  return NextResponse.json({ rows: matchedRows, detectedPeriod, confidentColumnMatch });
}
