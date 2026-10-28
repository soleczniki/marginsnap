import { LegalShell } from "@/components/LegalShell";

// Sourced from MarginSnap_Terms_of_Service_DRAFT.md — keep the two in sync, or
// better, delete the standalone .md once this page is the source of truth.
//
// 2026-09-24 (Bogdan's request) — draft banner removed and PublicNav added
// up top (this page previously had no header at all). See PublicNav.tsx.
// 2026-10-28: the frame (menu, footer, feedback button) now comes from
// LegalShell.tsx, which picks the signed-in or public menu.
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
      <LegalShell>
      <h1>MarginSnap Terms of Service</h1>
      <p><em>Last updated: October 28, 2026</em></p>
      <p>
        Operated by <strong>Lenis res, MB</strong>, a company registered in
        Lithuania (company code 302896460), registered address Antakalnio g. 17, Vilnius,
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
      <p>MarginSnap is a paid monthly subscription, billed in advance via Stripe. Current pricing is shown at checkout and in your account&rsquo;s billing settings. Prices are shown without VAT or other sales tax. Where tax applies, it is calculated at checkout from your billing country and added to the price; businesses in the EU that enter a valid VAT number are invoiced under the reverse-charge rule. Cancel anytime via the Stripe customer portal in Settings; cancelling stops the next renewal and you keep access until the end of the period you have paid for. Apart from the right of withdrawal below, we do not refund partial billing periods. Pricing changes get 30 days&rsquo; notice.</p>
      <p>If you are a consumer in the EU/EEA, you can withdraw from a new paid subscription within 14 days of your first payment and get that payment refunded in full: write to <a href="mailto:hello@marginsnap.app">hello@marginsnap.app</a>. Refunds are issued with a credit note to the original payment method.</p>

      <h2>5a. Free trial</h2>
      <p>Every new account gets a 30-day free trial that starts when the account is created. No card is needed and nothing is charged during the trial. We email you before it ends. When it ends, access to your dashboard pauses until you subscribe; your data is kept. You are never charged automatically at the end of the trial: a paid subscription starts only when you choose to subscribe at checkout.</p>

      <h2>6. Acceptable use</h2>
      <p>No violating Etsy&rsquo;s terms, no accessing another seller&rsquo;s data, no scraping or reselling the service, no connecting a shop you&rsquo;re not authorized to manage.</p>

      <h2>7. Your data</h2>
      <p>You own your shop&rsquo;s order history and the cost figures you enter. Export as CSV anytime; delete your account and our copy whenever you choose.</p>

      <h2>8. Disclaimers and liability</h2>
      <p>Provided &ldquo;as is.&rdquo; We don&rsquo;t guarantee uninterrupted service or that Etsy&rsquo;s API stays available. To the extent permitted by law, our total liability to you for any claim arising from your use of MarginSnap is limited to the amount you paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law, such as liability for intent, gross negligence or personal injury, or the mandatory rights you have as a consumer.</p>

      <h2>9. Termination</h2>
      <p>You can leave anytime. We may suspend an account that violates these terms or Etsy&rsquo;s own policies, with notice where practical.</p>

      <h2>10. Changes</h2>
      <p>Active users notified by email before a material change takes effect.</p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of Lithuania, where Lenis res, MB is registered. If you are a consumer, you keep the mandatory consumer protections of the country where you live. Disputes with business customers are handled by the courts of Vilnius, Lithuania.</p>

      <h2>12. Contact</h2>
      <p>Lenis res, MB - Antakalnio g. 17, Vilnius, Lithuania · <a href="mailto:hello@marginsnap.app">hello@marginsnap.app</a></p>
      </LegalShell>
    </>
  );
}
