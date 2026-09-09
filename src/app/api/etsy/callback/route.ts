import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeCodeForTokens, extractUserIdFromAccessToken, getShopForUser } from "@/lib/etsy";

// Finishes the OAuth flow (Blueprint workflow §1, steps 3-4): exchanges the
// code for tokens, resolves the seller's shop, stores it encrypted, and kicks
// off the initial backfill sync (fire-and-forget — the dashboard shows a
// "syncing…" state while /api/cron/sync's logic runs for this shop).
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.match(/etsy_oauth_state=([^;]+)/)?.[1];
  const cookieVerifier = request.headers
    .get("cookie")
    ?.match(/etsy_oauth_verifier=([^;]+)/)?.[1];

  if (!code || !state || !cookieState || state !== cookieState || !cookieVerifier) {
    return NextResponse.redirect(new URL("/dashboard?error=etsy_state_mismatch", request.url));
  }

  const redirectUri = new URL("/api/etsy/callback", request.url).toString();
  const tokens = await exchangeCodeForTokens({
    code,
    codeVerifier: cookieVerifier,
    redirectUri,
  });

  const etsyUserId = extractUserIdFromAccessToken(tokens.access_token);
  const shopsResponse = await getShopForUser(tokens.access_token, etsyUserId);
  // ⚠️ Shape unverified — confirm the real response has `results: [{ shop_id, shop_name }]`
  // once this runs against a live token (see the note at the top of src/lib/etsy.ts).
  const shop = shopsResponse?.results?.[0];

  await prisma.shop.create({
    data: {
      userId: session.user.id,
      marketplace: "etsy",
      etsyShopId: shop?.shop_id ? BigInt(shop.shop_id) : null,
      shopName: shop?.shop_name ?? null,
      accessTokenEnc: encryptToken(tokens.access_token),
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  // TODO (Phase 2/3): trigger the initial 90-day backfill here rather than
  // waiting for the next scheduled /api/cron/sync tick, so the seller doesn't
  // stare at an empty dashboard for up to 30 minutes after connecting.

  const response = NextResponse.redirect(new URL("/dashboard?connected=1", request.url));
  response.cookies.delete("etsy_oauth_verifier");
  response.cookies.delete("etsy_oauth_state");
  return response;
}
