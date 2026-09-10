import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { exchangeCodeForTokens, extractUserIdFromAccessToken, getShopForUser } from "@/lib/etsy";
import { syncShop } from "@/lib/sync";

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
  // Verified against a live key: this returns the shop object directly
  // (e.g. { shop_id, shop_name, user_id, ... }) — NOT wrapped in a
  // `results` array like the pre-launch draft of this code assumed.
  const shop = await getShopForUser(tokens.access_token, etsyUserId);

  // One shop per account in this version (Blueprint decision). If this user
  // already has a shop connected, replace it (cascades to its listings/orders)
  // rather than accumulating duplicate rows on every reconnect.
  await prisma.shop.deleteMany({ where: { userId: session.user.id } });

  const newShop = await prisma.shop.create({
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

  // Sync immediately so the seller sees real data right away instead of
  // waiting for the next scheduled cron run (which, on Vercel's free Hobby
  // plan, could be up to 24 hours away). Best-effort: if this throws, the
  // shop is still connected and the next cron run will pick it up.
  try {
    await syncShop(newShop);
  } catch (err) {
    console.error("Initial sync after connect failed:", err);
  }

  const response = NextResponse.redirect(new URL("/dashboard?connected=1", request.url));
  response.cookies.delete("etsy_oauth_verifier");
  response.cookies.delete("etsy_oauth_state");
  return response;
}
