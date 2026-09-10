// Etsy Open API v3 client — OAuth 2.0 + PKCE, and the handful of endpoints
// MarginSnap needs (shop, listings, receipts/transactions).
//
// ⚠️ UNVERIFIED AGAINST A LIVE KEY. Endpoint paths and scope names below
// follow Etsy's published Open API v3 docs as of this writing, but I have not
// made a real call with real credentials yet — do that verification as the
// very first step once the Seller App key exists (Blueprint Roadmap, Phase 2,
// step 4), and correct anything here that doesn't match a real response.
// Docs: https://developers.etsy.com/documentation/

const ETSY_AUTH_URL = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN_URL = "https://api.etsy.com/v3/public/oauth/token";
const ETSY_API_BASE = "https://openapi.etsy.com/v3/application";

// Scopes: read-only, nothing that can modify the seller's shop.
// Verify these exact scope strings against developer.etsy.com before going live —
// listed here as documented, not yet observed in a real consent screen.
const SCOPES = ["shops_r", "listings_r", "transactions_r"].join(" ");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// ---------- PKCE helpers ----------

export function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function makeCodeChallenge(verifier: string): Promise<string> {
  const { createHash } = await import("crypto");
  const hash = createHash("sha256").update(verifier).digest();
  return base64url(hash);
}

// ---------- Step 1: send the seller to Etsy's consent screen ----------

export function buildAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const clientId = requireEnv("ETSY_KEYSTRING");
  const url = new URL(ETSY_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// ---------- Step 2: exchange the callback code for tokens ----------

export type EtsyTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
};

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<EtsyTokenResponse> {
  const clientId = requireEnv("ETSY_KEYSTRING");
  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: params.redirectUri,
      code: params.code,
      code_verifier: params.codeVerifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`Etsy token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<EtsyTokenResponse> {
  const clientId = requireEnv("ETSY_KEYSTRING");
  const res = await fetch(ETSY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Etsy token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// ---------- Authenticated API calls ----------

async function etsyGet(path: string, accessToken: string) {
  const clientId = requireEnv("ETSY_KEYSTRING");
  const sharedSecret = requireEnv("ETSY_SHARED_SECRET");
  // As of Etsy's Feb 9, 2026 API change, x-api-key must be "keystring:shared_secret"
  // — the keystring alone (what older docs describe) is no longer accepted.
  const res = await fetch(`${ETSY_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": `${clientId}:${sharedSecret}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Etsy API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Etsy identifies "the shop I'm authorized for" via the token's user id —
// GET /application/users/{user_id}/shops is the documented way to resolve it.
// The user id itself comes back embedded in the access token (as the part
// before the colon, per Etsy's docs) — confirm this against a real token.
export function extractUserIdFromAccessToken(accessToken: string): string {
  const [userId] = accessToken.split(".");
  return userId;
}

// Verified against a live key: returns the shop object directly
// (e.g. { shop_id, shop_name, user_id, ... }), not wrapped in a `results` array.
export async function getShopForUser(accessToken: string, etsyUserId: string) {
  return etsyGet(`/users/${etsyUserId}/shops`, accessToken);
}

export async function listActiveListings(accessToken: string, shopId: string | bigint, limit = 100, offset = 0) {
  return etsyGet(`/shops/${shopId}/listings/active?limit=${limit}&offset=${offset}`, accessToken);
}

// "receipts" is Etsy's term for orders. min_created is a Unix timestamp —
// used for incremental sync (Blueprint workflow §3: "pull receipts since last_synced_at").
export async function listReceiptsSince(
  accessToken: string,
  shopId: string | bigint,
  minCreatedUnix: number,
  limit = 100,
  offset = 0
) {
  return etsyGet(
    `/shops/${shopId}/receipts?min_created=${minCreatedUnix}&limit=${limit}&offset=${offset}`,
    accessToken
  );
}
