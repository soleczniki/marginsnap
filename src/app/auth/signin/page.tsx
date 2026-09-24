import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { SignInForm } from "@/components/SignInForm";

// Dedicated sign-in page (2026-09-24, Bogdan's request) — previously the
// nav's "Sign in" link just anchored (#start) to the bottom of the landing
// page, which is titled "Start your free trial" and framed entirely as
// signup — confusing for a returning user who isn't starting anything.
// This is a real separate page/route instead, and reuses the exact same
// SignInForm mechanics (still one form, one email field — NextAuth's
// email/magic-link provider creates the account on first use either way,
// so there's still no way to tell signup from sign-in before the email's
// submitted; see PROJECT.md's "Separate sign-up from sign-in" backlog item
// for the fuller fix that would actually need). The one real difference
// here: showTermsCheckbox={false} — a returning user shouldn't have to
// re-check "I agree" every time they sign in (see SignInForm.tsx's comment).
//
// Same session-check-then-redirect pattern as src/app/page.tsx: a
// signed-in visitor who lands here (e.g. an old bookmark) goes straight to
// /dashboard instead of seeing a sign-in form again.
export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/dashboard");

  return (
    <>
      <SignInForm
        title="Sign in to MarginSnap"
        subtitle="Enter your email and we'll send you a sign-in link."
        showTermsCheckbox={false}
      />
      <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--muted)", marginTop: -24, paddingBottom: 40 }}>
        New here? <a href="/#start">Start your free trial</a> instead.
      </p>
    </>
  );
}
