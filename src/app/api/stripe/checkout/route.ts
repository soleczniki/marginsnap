import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Starts a Stripe Checkout session for the signed-in user to subscribe —
// $9/mo, single tier (2026-09-17, Bogdan's call). Reachable any time, trial
// or not: someone mid-trial can subscribe early, and someone past it lands
// here from TrialEndedScreen. src/app/api/stripe/webhook/route.ts is what
// actually flips subscriptionStatus to "active" once checkout completes.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const baseUrl = new URL(request.url).origin;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    client_reference_id: user.id,
    success_url: `${baseUrl}/dashboard?billing=success`,
    cancel_url: `${baseUrl}/dashboard?billing=cancelled`,
  });

  if (!checkoutSession.url) {
    return NextResponse.redirect(new URL("/dashboard?billing=error", request.url));
  }

  return NextResponse.redirect(checkoutSession.url);
}
