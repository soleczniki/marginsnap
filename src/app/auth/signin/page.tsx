import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInForm } from "@/components/SignInForm";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { isBetaClosed } from "@/lib/beta";

// Dedicated sign-in page (2026-09-24, Bogdan's request) - previously the
// nav's "Sign in" link just anchored to the bottom of the landing page,
// which is framed entirely as signup. This is a real separate page that
// reuses the same SignInForm (one email field; NextAuth's email provider
// creates the account on first use either way, but the email a brand-new
// address receives is the welcome/confirm version - see src/lib/auth.ts).
// showTermsCheckbox={false}: a returning user shouldn't have to re-check
// "I agree" every time they sign in.
//
// 2026-10-28 (Bogdan's report: "no back or X, no footer"): now has a header
// with the logo and a close (X) link back to the site, and the standard
// Privacy/Terms footer at the bottom instead of loose links in the middle.
//
// Same session-check-then-redirect pattern as src/app/page.tsx: a
// signed-in visitor who lands here goes straight to /dashboard.
export default async function SignInPage() {
  const closed = await isBetaClosed();
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/dashboard");

  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Logo />
        <a
          href="/"
          aria-label="Close and go back to the home page"
          style={{ fontSize: "1.6rem", lineHeight: 1, color: "var(--muted)", textDecoration: "none", padding: "0 4px" }}
        >
          ×
        </a>
      </header>
      <SignInForm
        title="Sign in to MarginSnap"
        subtitle="Enter your email and we'll send you a sign-in link."
        showTermsCheckbox={false}
        showLegalLinks={false}
      />
      <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--muted)", paddingBottom: 40 }}>
        {closed ? (
          <>New here? The beta is full for now. <a href="/#start">Join the waiting list</a>.</>
        ) : (
          <>New here? <a href="/#start">Start your free trial</a> instead.</>
        )}
      </p>
      <Footer />
    </>
  );
}
