import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { matchListingLabel } from "@/lib/adSpendImport";
import { parseAdSpendScreenshot } from "@/lib/adSpendVision";

// Step 1 of the "upload/paste a screenshot" ad-spend import (2026-09-17) —
// the vision-based sibling of /api/ad-spend/parse-paste. Same contract:
// reads and matches, saves nothing. imageBase64 is the raw base64 payload
// (no "data:image/png;base64," prefix — the frontend strips that before
// sending) capped well under Vercel's request body limit since this is one
// screenshot, not a batch upload.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const imageBase64: string | undefined = body?.imageBase64;
  const mediaType: string | undefined = body?.mediaType;
  if (typeof imageBase64 !== "string" || !imageBase64 || typeof mediaType !== "string") {
    return NextResponse.json({ error: "no image received" }, { status: 400 });
  }
  // Vercel's serverless functions cap the whole request body at ~4.5MB —
  // base64 inflates a binary file by about a third, so anything much past
  // ~3MB of raw image data would get rejected by the platform before this
  // code even runs (as an opaque 413, not this friendly message). Checking
  // here first, well under that ceiling, means a seller who screenshots a
  // huge 4K monitor gets told to crop to just the stats table instead.
  if (imageBase64.length > 4_000_000) {
    return NextResponse.json(
      { error: "that image is too large — crop it to just the stats table and try again" },
      { status: 400 }
    );
  }

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) return NextResponse.json({ error: "connect an Etsy shop first" }, { status: 400 });

  let result;
  try {
    result = await parseAdSpendScreenshot(imageBase64, mediaType);
  } catch (err) {
    if (err instanceof Error && err.message.includes("ANTHROPIC_API_KEY")) {
      return NextResponse.json(
        { error: "screenshot import isn't set up yet — ask whoever manages this app to add an Anthropic API key" },
        { status: 503 }
      );
    }
    console.error("ad-spend screenshot parse failed", err);
    return NextResponse.json(
      { error: "couldn't read that screenshot — try again, or use the paste-text option instead" },
      { status: 502 }
    );
  }

  if (result.rows.length === 0) {
    return NextResponse.json(
      { error: "couldn't find any spend numbers in that screenshot — make sure the Spend column is visible and try again" },
      { status: 400 }
    );
  }

  const listings = await prisma.listing.findMany({ where: { shopId: shop.id }, select: { id: true, title: true } });
  const matchedRows = result.rows.map((row) => {
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

  return NextResponse.json({ rows: matchedRows, detectedPeriod: result.detectedPeriod, confidentColumnMatch: true });
}
