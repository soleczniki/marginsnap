import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { base64url, buildAuthorizeUrl, makeCodeChallenge } from "@/lib/etsy";

// Starts the Etsy OAuth+PKCE flow (Blueprint workflow §1, step 2).
// GET /api/etsy/connect → redirects the seller to Etsy's consent screen.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = await makeCodeChallenge(codeVerifier);
  const state = base64url(randomBytes(16));

  const redirectUri = new URL("/api/etsy/callback", request.url).toString();
  const authorizeUrl = buildAuthorizeUrl({ state, codeChallenge, redirectUri });

  const response = NextResponse.redirect(authorizeUrl);
  // Short-lived, httpOnly — only needed to survive the redirect round-trip to Etsy and back.
  const cookieOpts = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 60 * 10,
    path: "/api/etsy",
  };
  response.cookies.set("etsy_oauth_verifier", codeVerifier, cookieOpts);
  response.cookies.set("etsy_oauth_state", state, cookieOpts);
  return response;
}
