import Stripe from "stripe";

// Single shared Stripe client. Billed monthly via a single price
// (STRIPE_PRICE_ID) — see the Blueprint's pricing decision.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});
