import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Stripe calls this whenever a subscription is created, updated, or
// cancelled — it's the source of truth for User.subscriptionStatus.
// Vercel needs raw body access for signature verification, hence the
// dynamic route config below (no body parsing/caching).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        const userId = checkoutSession.client_reference_id;
        if (userId && checkoutSession.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: String(checkoutSession.customer) },
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: subscription.status,
              subscriptionPriceId: subscription.items.data[0]?.price.id ?? null,
            },
          });
        }
        break;
      }
      default:
        // Ignore event types we don't act on.
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler failed:", err);
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
