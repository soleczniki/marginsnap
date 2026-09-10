import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncShop } from "@/lib/sync";

// The scheduled sync job (Blueprint workflow §3 / Architecture diagram's
// "cron sync job" box). Configured in vercel.json (currently once a day —
// Vercel's free Hobby plan only allows daily cron jobs); Vercel Cron calls
// this with the CRON_SECRET as a bearer token.
//
// The actual per-shop work lives in src/lib/sync.ts (syncShop) so that the
// same logic also runs immediately right after a shop connects, and from the
// manual "Sync now" button — this route is just "do it for every shop."
//
// ⚠️ The fee/shipping math in syncShop (feesBreakdown, shippingCost) is a
// stub — see the note at the top of src/lib/sync.ts. Don't trust this file's
// profit numbers until that's verified against a real receipt response.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shops = await prisma.shop.findMany({
    where: { marketplace: "etsy", accessTokenEnc: { not: null } },
  });

  const results: Array<{ shopId: string; ordersSynced: number; listingsSynced: number; error?: string }> = [];

  for (const shop of shops) {
    try {
      const { listingsSynced, ordersSynced } = await syncShop(shop);
      results.push({ shopId: shop.id, ordersSynced, listingsSynced });
    } catch (err) {
      results.push({ shopId: shop.id, ordersSynced: 0, listingsSynced: 0, error: (err as Error).message });
    }
  }

  return NextResponse.json({ synced: results });
}
