import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBillingStatus } from "@/lib/billing";
import { isAdminUser } from "@/lib/admin";
import { SubpageHeader } from "@/components/SubpageHeader";
import { FeedbackForm } from "@/components/FeedbackForm";
import { Footer } from "@/components/Footer";

// Feedback page (2026-10-28, Bogdan's request). Open to every signed-in user
// - including one whose trial ended, since that is exactly who might want to
// say why - so unlike the other dashboard pages it does not need a shop.
export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const billing = getBillingStatus(user);

  return (
    <>
      <SubpageHeader navId="feedback-nav-toggle" isSubscribed={billing.isPaying} isAdmin={isAdminUser(user)} />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 80px" }}>
        <a href="/dashboard" style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          ← Back to dashboard
        </a>
        <h1 style={{ fontSize: "1.4rem", margin: "8px 0 4px" }}>Send feedback</h1>
        <p style={{ color: "var(--muted)", marginBottom: 24 }}>
          Found a bug, or missing something? Tell us - it goes straight to the person who builds MarginSnap.
        </p>
        <FeedbackForm />
      </main>
      <Footer />
    </>
  );
}
