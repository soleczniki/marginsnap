// TEMPORARY DIAGNOSTIC ROUTE — DELETE THIS FILE ONCE YOU'VE GOTTEN THE
// RAW RECEIPTS JSON OUT OF IT. Do not leave this deployed.
//
// Why this exists: raw-receipt.ts (the local script) needs
// TOKEN_ENCRYPTION_KEY to decrypt the shop's stored Etsy token, but that key
// is marked "Sensitive" in Vercel and can never be copied out of the
// dashboard again. This route does the exact same thing raw-receipt.ts does,
// but runs ON Vercel, where TOKEN_ENCRYPTION_KEY is already sitting in
// process.env at runtime — so nothing needs to be copied anywhere.
//
// Auth: a hardcoded one-off token, NOT one of the app's real secrets. Anyone
// who has the URL + this exact token can read your shop's raw receipts data
// while this file exists, so: use it once, then delete the file and deploy
// again to remove the route.
//
// Deploy this file to: src/app/api/diag-receipts/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshAccessToken, listReceiptsSince } from "@/lib/etsy";

const DIAG_TOKEN = "9a82fd451a9c28f5cbb8061882b0d5d103d2304cc64a1e0b";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${DIAG_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findFirst({ where: { marketplace: "etsy" } });
  if (!shop || !shop.etsyShopId || !shop.accessTokenEnc) {
    return NextResponse.json({ error: "no connected etsy shop found" }, { status: 404 });
  }

  let accessToken = decryptToken(shop.accessTokenEnc);

  if (!shop.tokenExpiresAt || shop.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    const refreshed = await refreshAccessToken(decryptToken(shop.refreshTokenEnc!));
    accessToken = refreshed.access_token;
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        accessTokenEnc: encryptToken(refreshed.access_token),
        refreshTokenEnc: encryptToken(refreshed.refresh_token),
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
  }

  const minCreated = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000); // last 90 days
  const receipts = await listReceiptsSince(accessToken, shop.etsyShopId.toString(), minCreated);

  return NextResponse.json({
    shop: { shopName: shop.shopName, etsyShopId: shop.etsyShopId.toString() },
    receipts,
  });
}
