import { PublicNav } from "@/components/PublicNav";

// Sourced from MarginSnap_Terms_of_Service_DRAFT.md — keep the two in sync, or
// better, delete the standalone .md once this page is the source of truth.
//
// 2026-09-24 (Bogdan's request) — draft banner removed and PublicNav added
// up top (this page previously had no header at all). See PublicNav.tsx.
// Also pulled two inline "(A lawyer should ...)" notes out of the live
// user-facing text (they were sitting in the actual paragraphs) — moved here
// instead so a real lawyer pass still knows to look at them:
//   §8 Disclaimers and liability — the liability cap may need tightening;
//     enforceability varies by jurisdiction and consumer vs. business.
//   §11 Governing law — Lithuania as governing law may need confirming as
//     workable given customers can be located elsewhere.
export default function TermsOfService() {
  return (
    <>
      <PublicNav />
      <main className="legal-doc">
      <h1>MarginSnap Terms of Service</h1>
      <p><em>Last updated: September 24, 2026</em></p>
      <p>
        Operated by <strong>Lenis res, MB</strong> (trading as Lendas), a company registered in
        Lithuania (company code 302896460), registered address Antalkalnio g. 17, Vilnius,
        Lithuania. By creating an account you agree to these terms.
      </p>

      <h2>1. What MarginSnap is</h2>
      <p>MarginSnap connects to your Etsy shop via Etsy&rsquo;s own OAuth flow and estimates your profit per order and per listing, from Etsy&rsquo;s data and the costs you enter.</p>
      <p><strong>MarginSnap is not affiliated with, endorsed by, or sponsored by Etsy, Inc.</strong> Etsy is a trademark of Etsy, Inc., referenced only to describe compatibility.</p>

      <h2>2. Not financial, accounting, or tax advice</h2>
      <p>Profit figures are estimates for your own reference, not accounting or tax advice. Verify against Etsy&rsquo;s own reports and consult an accountant for anything that needs to be exact.</p>

      <h2>3. Your account</h2>
      <p>One email, one account. You&rsquo;re responsible for keeping access to that email secure. One Etsy shop per account in this version.</p>

      <h2>4. Connecting your Etsy shop</h2>
      <p>Authorizes MarginSnap to read your listings and orders under the scopes Etsy&rsquo;s consent screen describes. Disconnect anytime from Settings. You&rsquo;re responsible for your own compliance with Etsy&rsquo;s seller policies.</p>

      <h2>5. Subscription and billing</h2>
      {/* 2026-09-24 (Bogdan's request) — was "currently free during early
         access... launch in a future update", stale since billing went live
         2026-09-17 (see src/app/api/stripe/checkout/route.ts). Deliberately
         doesn't restate the actual price here (Bogdan's call) — current
         pricing lives at checkout/the billing portal, one place, so it can
         change without this page going stale again. IF THAT EVER CHANGES —
         a second tier, a different billing cycle, anything about how
         subscriptions work — update this section too; see the matching
         reminder on checkout/route.ts. */}
      <p>MarginSnap is a paid monthly subscription, billed in advance via Stripe. Current pricing is shown at checkout and in your account&rsquo;s billing settings. Cancel anytime via the Stripe customer portal in Settings; no refunds for partial billing periods; pricing changes get 30 days&rsquo; notice.</p>

      <h2>6. Acceptable use</h2>
      <p>No violating Etsy&rsquo;s terms, no accessing another seller&rsquo;s data, no scraping or reselling the service, no connecting a shop you&rsquo;re not authorized to manage.</p>

      <h2>7. Your data</h2>
      <p>You own your shop&rsquo;s order history and the cost figures you enter. Export as CSV anytime; delete your account and our copy whenever you choose.</p>

      <h2>8. Disclaimers and liability</h2>
      <p>Provided &ldquo;as is.&rdquo; We don&rsquo;t guarantee uninterrupted service or that Etsy&rsquo;s API stays available. To the extent permitted by law, our total liability to you for any claim arising from your use of MarginSnap is limited to the amount you paid us in the 12 months before the claim.</p>

      <h2>9. Termination</h2>
      <p>You can leave anytime. We may suspend an account that violates these terms or Etsy&rsquo;s own policies, with notice where practical.</p>

      <h2>10. Changes</h2>
      <p>Active users notified by email before a material change takes effect.</p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of Lithuania, where Lenis res, MB is registered.</p>

      <h2>12. Contact</h2>
      <p>Lenis res, MB — Antalkalnio g. 17, Vilnius, Lithuania · <a href="mailto:hello@lendas.lt">hello@lendas.lt</a></p>
      </main>
    </>
  );
}
