import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Starts a Stripe Checkout session for the signed-in user to subscribe.
// MarginSnap is currently free during early access (Terms of Service §5) —
// this exists so the "Upgrade" flow works end to end whenever billing is
// switched on; nothing gates access on subscriptionStatus yet.
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
