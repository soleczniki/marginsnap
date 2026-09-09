// Sourced from MarginSnap_Terms_of_Service_DRAFT.md — keep the two in sync, or
// better, delete the standalone .md once this page is the source of truth.
export default function TermsOfService() {
  return (
    <main className="legal-doc">
      <div className="card" style={{ marginBottom: 32, borderColor: "var(--loss)" }}>
        <strong>Draft — not legal advice, not reviewed by a lawyer.</strong> Fill in every{" "}
        <code>[PLACEHOLDER]</code> below, and get a lawyer&rsquo;s eyes on the liability and
        governing-law sections especially, before this is relied on.
      </div>

      <h1>MarginSnap Terms of Service</h1>
      <p><em>Last updated: [DATE]</em></p>
      <p>
        Operated by <strong>Lendas</strong> ([FULL LEGAL ENTITY NAME AND ADDRESS]). By creating an
        account you agree to these terms.
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
      <p>Billed [monthly] in advance via Stripe at the price shown at signup. [Free trial length, if any.] Cancel anytime via the Stripe customer portal in Settings. [Refund policy — decide and state it.] Pricing changes get [30] days&rsquo; notice.</p>

      <h2>6. Acceptable use</h2>
      <p>No violating Etsy&rsquo;s terms, no accessing another seller&rsquo;s data, no scraping or reselling the service, no connecting a shop you&rsquo;re not authorized to manage.</p>

      <h2>7. Your data</h2>
      <p>You own your shop&rsquo;s order history and the cost figures you enter. Export as CSV anytime; delete your account and our copy whenever you choose.</p>

      <h2>8. Disclaimers and liability</h2>
      <p>Provided &ldquo;as is.&rdquo; We don&rsquo;t guarantee uninterrupted service or that Etsy&rsquo;s API stays available. [Liability cap and governing law — a lawyer should tighten this section specifically; enforceability varies by jurisdiction and by consumer vs. business customer.]</p>

      <h2>9. Termination</h2>
      <p>You can leave anytime. We may suspend an account that violates these terms or Etsy&rsquo;s own policies, with notice where practical.</p>

      <h2>10. Changes</h2>
      <p>Active users notified by email before a material change takes effect.</p>

      <h2>11. Governing law</h2>
      <p>[To decide with a lawyer — likely Lithuania, given Lendas is based there; confirm it&rsquo;s workable given most customers are elsewhere.]</p>

      <h2>12. Contact</h2>
      <p>Lendas — [FULL LEGAL ENTITY NAME, ADDRESS] · <a href="mailto:hello@lendas.lt">hello@lendas.lt</a></p>
    </main>
  );
}
