// One-off CLI to verify src/lib/etsy.ts against a real Etsy account —
// without running the full Next.js app or touching the database. This is
// throwaway verification tooling, not a product feature; delete it (or leave
// it here, it's harmless) once etsy.ts/sync.ts are confirmed against real
// data.
//
// MUST be run on your own machine, not in a cloud sandbox — Etsy's API
// domains are not reachable from there.
//
// Usage (two steps, run from the project root):
//
//   0. ONE-TIME SETUP: marginsnap.app is a real, live deployment with its
//      own /api/etsy/callback route — so this script can no longer reuse
//      that URL (Etsy would deliver the code straight to the live app,
//      which consumes it and rejects this script's independently-generated
//      state/verifier with ?error=etsy_state_mismatch). Register a second,
//      throwaway callback URL in the Etsy app's settings
//      (https://www.etsy.com/developers/your-apps -> the app -> Callback
//      URL(s)): add https://www.marginsnap.app/api/etsy/callback-verify
//      alongside the existing one (don't remove the existing one — the
//      live app still needs it). Same domain, so it passes Etsy's
//      "must be a real domain" check; different path, so Next.js has no
//      route for it and the real callback logic never runs.
//
//   1. ETSY_KEYSTRING=... ETSY_SHARED_SECRET=... npx tsx scripts/etsy-verify.ts authorize
//
//      Prints a URL. Whoever is signed in to the shop's Etsy account (you or
//      your friend) opens it and clicks "Allow". Etsy will then try to
//      redirect the browser to https://www.marginsnap.app/api/etsy/callback-verify
//      — nothing is deployed at that path, so the page will 404. That's
//      fine: copy the FULL url from the address bar anyway (it still
//      carries the code) and send it back to whoever runs step 2.
//
//   2. ETSY_KEYSTRING=... ETSY_SHARED_SECRET=... npx tsx scripts/etsy-verify.ts exchange "<that full redirected url>"
//
//      Exchanges the code for tokens, then calls the exact functions in
//      etsy.ts (getShopForUser, listActiveListings, listReceiptsSince) and
//      writes their raw, unmodified JSON responses to ./etsy-verify-output/
//      for comparison against what etsy.ts and sync.ts currently assume.
//
// The authorization code Etsy issues expires in minutes — run step 2 right
// after getting the redirected URL from step 1, don't let it sit.

import { randomBytes, createHash } from "node:crypto";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import {
  base64url,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  extractUserIdFromAccessToken,
  getShopForUser,
  listActiveListings,
  listReceiptsSince,
} from "../src/lib/etsy";

const REDIRECT_URI = "https://www.marginsnap.app/api/etsy/callback-verify";
const SESSION_FILE = ".etsy-verify-session.json";
const OUTPUT_DIR = "etsy-verify-output";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Set it and re-run, e.g.:`);
    console.error(`  ETSY_KEYSTRING=... ETSY_SHARED_SECRET=... npx tsx scripts/etsy-verify.ts ${process.argv[2] ?? "authorize"}`);
    process.exit(1);
  }
  return v;
}

function authorize() {
  requireEnv("ETSY_KEYSTRING");

  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));

  writeFileSync(SESSION_FILE, JSON.stringify({ verifier, state, redirectUri: REDIRECT_URI }, null, 2));

  const url = buildAuthorizeUrl({ state, codeChallenge: challenge, redirectUri: REDIRECT_URI });

  console.log(`\nUsing the throwaway callback URL: ${REDIRECT_URI}`);
  console.log("(Make sure that's registered in the Etsy app's Callback URL(s) list before opening this — see step 0 at the top of this file.)");
  console.log("\n1. Open this URL, signed in as the shop's owner, and click Allow:\n");
  console.log(url);
  console.log(`\n2. The redirect will 404 (nothing's deployed at that path) — copy the FULL url`);
  console.log('   from the address bar and run (soon — the code expires in minutes):');
  console.log(`   ETSY_KEYSTRING=... ETSY_SHARED_SECRET=... npx tsx scripts/etsy-verify.ts exchange "<that full url>"\n`);
}

async function exchange(redirectedUrl: string) {
  if (!existsSync(SESSION_FILE)) {
    console.error(`No ${SESSION_FILE} found in this directory — run "authorize" first, from the same directory.`);
    process.exit(1);
  }
  const { verifier, state: expectedState, redirectUri } = JSON.parse(readFileSync(SESSION_FILE, "utf8"));

  let url: URL;
  try {
    url = new URL(redirectedUrl);
  } catch {
    console.error("That doesn't look like a URL. Paste the exact address the browser tried to redirect to.");
    process.exit(1);
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    console.error("No ?code= param in that URL. Paste the exact URL the browser tried to redirect to after clicking Allow.");
    process.exit(1);
  }
  if (state !== expectedState) {
    console.error("State mismatch — this doesn't look like the redirect from the most recent \"authorize\" run. Re-run authorize and try again.");
    process.exit(1);
  }

  console.log("Exchanging code for tokens...");
  const tokens = await exchangeCodeForTokens({ code, codeVerifier: verifier, redirectUri });
  console.log(`Got an access token (expires in ${tokens.expires_in}s) and a refresh token.`);

  const etsyUserId = extractUserIdFromAccessToken(tokens.access_token);
  console.log(`Etsy user id extracted from the token: ${etsyUserId}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log("\nCalling getShopForUser...");
  const shopJson = await getShopForUser(tokens.access_token, etsyUserId);
  writeFileSync(`${OUTPUT_DIR}/shop.json`, JSON.stringify(shopJson, null, 2));
  console.log(`  -> ${OUTPUT_DIR}/shop.json`);

  // getShopForUser's header comment says it returns the shop object
  // directly; if that's wrong, this line is exactly the kind of thing this
  // script exists to catch, so it's left unguarded rather than defensively
  // reshaped around a guess.
  const shopId = shopJson?.shop_id ?? shopJson?.results?.[0]?.shop_id;
  if (!shopId) {
    console.log(`\nCouldn't find a shop_id in the response above — open ${OUTPUT_DIR}/shop.json and see what shape it actually came back in. Stopping here; re-run listings/receipts by hand once you know the right field.`);
    return;
  }
  console.log(`Shop id: ${shopId}`);

  console.log("\nCalling listActiveListings...");
  const listingsJson = await listActiveListings(tokens.access_token, shopId);
  writeFileSync(`${OUTPUT_DIR}/listings.json`, JSON.stringify(listingsJson, null, 2));
  console.log(`  -> ${OUTPUT_DIR}/listings.json`);

  console.log("\nCalling listReceiptsSince (last 90 days)...");
  const minCreated = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);
  const receiptsJson = await listReceiptsSince(tokens.access_token, shopId, minCreated);
  writeFileSync(`${OUTPUT_DIR}/receipts.json`, JSON.stringify(receiptsJson, null, 2));
  console.log(`  -> ${OUTPUT_DIR}/receipts.json`);

  console.log(`\nDone. Send me the three files in ${OUTPUT_DIR}/ and I'll compare them against etsy.ts/sync.ts and fix whatever doesn't match.`);
}

const [, , cmd, arg] = process.argv;
if (cmd === "authorize") {
  authorize();
} else if (cmd === "exchange" && arg) {
  exchange(arg).catch((err) => {
    console.error("\nFailed:", err.message ?? err);
    process.exit(1);
  });
} else {
  console.log('Usage:\n  npx tsx scripts/etsy-verify.ts authorize\n  npx tsx scripts/etsy-verify.ts exchange "<redirected url>"');
  process.exit(1);
}
