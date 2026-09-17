import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

// Keeps User.subscriptionStatus/stripeCustomerId/subscriptionPriceId in
// sync with Stripe (2026-09-17) — this route didn't exist before, so
// completing checkout never actually updated anything here: subscriptionStatus
// stayed null forever even after a real payment, and src/lib/billing.ts's
// gating depends entirely on this being correct.
//
// Setup (do this once, before going live): in the Stripe dashboard, add a
// webhook endpoint pointing at https://www.marginsnap.app/api/stripe/webhook,
// subscribed to checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, and customer.subscription.deleted — then
// set STRIPE_WEBHOOK_SECRET from the signing secret it gives you. Needs
// doing again (a new secret) when switching from test mode to live mode —
// see PROJECT.md's "before beta launch" checklist.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      // client_reference_id was set to our own user id when the checkout
      // session was created (see /api/stripe/checkout) — this is what ties
      // a completed Stripe checkout back to a MarginSnap account.
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (userId && session.customer) {
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: session.customer as string, subscriptionStatus: "active" },
        });
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findUnique({ where: { stripeCustomerId: subscription.customer as string } });
      if (user) {
        // Stripe's own statuses (active/past_due/canceled/unpaid/...) map
        // through directly — src/lib/billing.ts only ever treats "active"
        // as "currently paying," so anything else already behaves as
        // "not paying" without needing a full enum here.
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

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findUnique({ where: { stripeCustomerId: subscription.customer as string } });
      if (user) {
        await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: "canceled" } });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
