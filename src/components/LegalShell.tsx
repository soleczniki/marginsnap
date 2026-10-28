import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBillingStatus } from "@/lib/billing";
import { isAdminUser } from "@/lib/admin";
import { PublicNav } from "@/components/PublicNav";
import { SubpageHeader } from "@/components/SubpageHeader";
import { Footer } from "@/components/Footer";
import { FeedbackWidget } from "@/components/FeedbackWidget";

// Shared frame for the Privacy and Terms pages (2026-10-28, Bogdan's report:
// no footer, no feedback button, and a different menu than the rest of the
// app when signed in). Signed in: the same menu as every other app page,
// the footer, and the floating Feedback button. Signed out: the public site
// menu and the footer (feedback needs an account, so no button there).
export async function LegalShell({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  let header: React.ReactNode;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const billing = getBillingStatus(user);
    header = <SubpageHeader navId="legal-nav-toggle" isSubscribed={billing.isPaying} isAdmin={isAdminUser(user)} />;
  } else {
    header = <PublicNav />;
  }

  return (
    <>
      {header}
      <main className="legal-doc">{children}</main>
      <Footer />
      {userId && <FeedbackWidget />}
    </>
  );
}
