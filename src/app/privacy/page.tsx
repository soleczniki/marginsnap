// Sourced from MarginSnap_Privacy_Policy_DRAFT.md — keep the two in sync, or
// better, delete the standalone .md once this page is the source of truth.
export default function PrivacyPolicy() {
  return (
    <main className="legal-doc">
      <div className="card" style={{ marginBottom: 32, borderColor: "var(--loss)" }}>
        <strong>Draft — not legal advice, not reviewed by a lawyer.</strong> Fill in every{" "}
        <code>[PLACEHOLDER]</code> below and have this reviewed before relying on it, especially
        before Etsy&rsquo;s Personal App review or a real launch.
      </div>

      <h1>MarginSnap Privacy Policy</h1>
      <p><em>Last updated: [DATE]</em></p>
      <p>
        MarginSnap is operated by <strong>Lendas</strong> ([FULL LEGAL ENTITY NAME AND REGISTERED
        ADDRESS]), &ldquo;we,&rdquo; &ldquo;us.&rdquo; Contact: <a href="mailto:hello@lendas.lt">hello@lendas.lt</a>.
      </p>

      <h2>1. What we collect</h2>
      <p>Your account email (magic-link sign-in, no password stored). Your Etsy shop&rsquo;s OAuth tokens, encrypted at rest. Your shop&rsquo;s listing titles/SKUs and order/receipt history, synced from Etsy. The cost-of-goods figures you enter yourself. Billing status from Stripe (never your card number). Standard server logs.</p>

      <h2>2. Why we use it</h2>
      <p>Only to run MarginSnap for you — sync and display your profit data, process your subscription, and support you if you ask. We never sell your data or use it to train any model.</p>

      <h2>3. Who else sees it</h2>
      <p>Etsy, Inc. (source of your data), Stripe (billing), [Vercel] (hosting), [Neon/Supabase] (database), [email provider] (magic links). No advertisers, no data brokers.</p>

      <h2>4. Storage and retention</h2>
      <p>Kept while your account is active. Disconnecting your shop stops new syncing immediately. Deleting your account removes your data within [30] days, except billing records we must keep by law.</p>

      <h2>5. Your rights</h2>
      <p>Access, correct, delete, or export your data at any time; object to or restrict its use; withdraw the Etsy connection whenever you choose. GDPR/UK GDPR and CCPA/CPRA rights apply where relevant.</p>

      <h2>6. Deleting your account</h2>
      <p>From Settings, or by emailing hello@lendas.lt — revokes our Etsy access and deletes your stored shop data permanently, other than required billing records.</p>

      <h2>7. Children</h2>
      <p>MarginSnap is a business tool, not directed at anyone under 18 [confirm against your jurisdiction&rsquo;s definition].</p>

      <h2>8. Changes</h2>
      <p>Active users are notified by email before a material change takes effect.</p>

      <h2>9. Contact</h2>
      <p>Lendas — [FULL LEGAL ENTITY NAME, ADDRESS] · <a href="mailto:hello@lendas.lt">hello@lendas.lt</a></p>
    </main>
  );
}
