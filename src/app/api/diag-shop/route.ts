// TEMPORARY DIAGNOSTIC ROUTE — DELETE THIS FILE ONCE YOU'VE SEEN THE RAW
// SHOP JSON. Do not leave this deployed.
//
// Why: sync.ts assumed Etsy's Shop object has `shop_location_country_iso`
// (per a third-party API client's docs), but sellerCountry never gets set
// after a real sync — so that assumption needs checking against the real
// response, the same way diag-receipts caught the money-field/fees bugs.
//
// Deploy this file to: src/app/api/diag-shop/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { refreshAccessToken, getShopForUser, extractUserIdFromAccessToken } from "@/lib/etsy";

const DIAG_TOKEN = "8dda6158e03977d820f0ffb012bee59e893653034623ec96";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${DIAG_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const shop = await prisma.shop.findFirst({ where: { marketplace: "etsy" } });
  if (!shop || !shop.accessTokenEnc) {
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

  const etsyUserId = extractUserIdFromAccessToken(accessToken);
  const shopInfo = await getShopForUser(accessToken, etsyUserId);

  return NextResponse.json({ etsyUserId, shopInfo });
}
