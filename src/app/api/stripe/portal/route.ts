import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Sends an already-subscribed user to Stripe's hosted portal to manage or
// cancel their subscription (Terms of Service §5: "cancel anytime via the
// Stripe customer portal in Settings").
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
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/dashboard`,
  });

  return NextResponse.redirect(portalSession.url);
}
