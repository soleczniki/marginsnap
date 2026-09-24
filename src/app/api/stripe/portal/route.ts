import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Sends an already-subscribed user to Stripe's hosted portal to manage or
// cancel their subscription (Terms of Service §5: "cancel anytime via the
// Stripe customer portal in Settings").
//
// 500 on this route (2026-09-24, Bogdan's report) — two known causes, both
// plausible right now, neither confirmable from here without live Stripe
// dashboard access:
//   1. Stripe's Customer Portal needs its own "default configuration"
//      activated per mode (test vs. live), separately from the account
//      itself being in live mode — https://dashboard.stripe.com/settings/billing/portal.
//      Since live mode was only just switched on (2026-09-22/23, see
//      PROJECT.md), the LIVE portal configuration may simply not exist yet
//      even though the test one does. `stripe.billingPortal.sessions.create`
//      throws if there's no default configuration for the current mode.
//   2. A `stripeCustomerId` created before the live-mode switch (including
//      Bogdan's own, per PROJECT.md's "Before beta launch" note) won't
//      resolve against the live secret key — Stripe throws "No such
//      customer" for it. Self-corrects once that account goes through one
//      real live checkout.
// Wrapped in try/catch below so either failure mode (or any other Stripe
// error) shows the user a plain message instead of a raw 500 — check Vercel's
// function logs for the real error text to tell #1 from #2 apart.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const baseUrl = new URL(request.url).origin;
  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/dashboard`,
    });
    return NextResponse.redirect(portalSession.url);
  } catch (err) {
    console.error("Stripe billing portal session failed:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/dashboard?billing_error=1", request.url));
  }
}
