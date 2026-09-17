import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OnboardingWizard } from "@/components/OnboardingWizard";

// First-time onboarding (2026-09-17) — reached from dashboard/page.tsx's
// redirect once the first sync has produced at least one listing.
// Redirects straight back to /dashboard for anyone who's already done
// this (or who somehow lands here with no shop yet), so it's never shown
// twice and can't be re-triggered by just visiting the URL.
export default async function Onboarding() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const shop = await prisma.shop.findFirst({ where: { userId: session.user.id } });
  if (!shop) redirect("/dashboard");
  if (shop.onboardedAt) redirect("/dashboard");

  const [listings, mostRecentOrder] = await Promise.all([
    prisma.listing.findMany({
      where: { shopId: shop.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.order.findFirst({ where: { shopId: shop.id }, orderBy: { orderDate: "desc" }, select: { currency: true } }),
  ]);

  return <OnboardingWizard listings={listings} currency={mostRecentOrder?.currency ?? null} />;
}
