// One-off diagnostic: use the shop's ALREADY-STORED, already-authorized
// token to call Etsy's real receipts endpoint directly and print the raw,
// unmodified JSON — no new OAuth consent needed from anyone, since the shop
// is already connected.
//
// Run on your own machine, from the project root:
//   npx tsx scripts/raw-receipt.ts
//
// Needs ETSY_KEYSTRING, ETSY_SHARED_SECRET, and TOKEN_ENCRYPTION_KEY. This
// script loads them from .env.local itself (Next.js does that automatically
// for the app; a plain script run via tsx doesn't, so this does it by hand)
// — nothing to set manually if .env.local already has them, which it should
// since the deployed app uses the same three.

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { decryptToken, encryptToken } from "../src/lib/crypto";
import { refreshAccessToken, listReceiptsSince } from "../src/lib/etsy";

function loadDotEnvLocal() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue; // don't override an explicitly-set env var
      const value = rawValue.replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvLocal();

  const shop = await prisma.shop.findFirst({ where: { marketplace: "etsy" } });
  if (!shop || !shop.etsyShopId || !shop.accessTokenEnc) {
    console.error("No connected Etsy shop found in the database.");
    process.exit(1);
  }
  console.log(`Using shop: ${shop.shopName} (${shop.etsyShopId})`);

  let accessToken = decryptToken(shop.accessTokenEnc);

  if (!shop.tokenExpiresAt || shop.tokenExpiresAt.getTime() < Date.now() + 60_000) {
    console.log("Token expired or expiring soon — refreshing...");
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

  const minCreated = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000); // last 7 days is plenty
  console.log("Calling listReceiptsSince...");
  const receipts = await listReceiptsSince(accessToken, shop.etsyShopId.toString(), minCreated);

  writeFileSync("raw-receipt-output.json", JSON.stringify(receipts, null, 2));
  console.log("\nWrote raw-receipt-output.json — paste its contents back.");
  console.log(JSON.stringify(receipts, null, 2));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err.message ?? err);
  await prisma.$disconnect();
  process.exit(1);
});
