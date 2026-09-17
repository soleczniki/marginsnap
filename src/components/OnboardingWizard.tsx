"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { currencySymbol } from "@/lib/money";

interface OnboardingListing {
  id: string;
  title: string;
}

// Small enough that a quick inline "type in each cost" step in the wizard
// beats sending someone off to a whole separate page for it; above this,
// scrolling through dozens of inputs in a modal-shaped flow gets worse than
// just pointing them at Manage Costs afterward (see Manage Costs' own
// notification for that case). Bogdan's call, 2026-09-17.
const SMALL_SHOP_THRESHOLD = 10;

// First-time onboarding wizard (2026-09-17, Bogdan's request): shown once,
// right after the first sync produces at least one listing (see
// src/app/dashboard/onboarding/page.tsx for the redirect gate). Three steps
// — VAT, shipping, and (small shops only) costs — each just a partial
// update to the Shop row via src/app/api/shop/onboarding/route.ts; costs
// reuse the existing per-listing COGS endpoint with mode "today".
export function OnboardingWizard({
  listings,
  currency,
}: {
  listings: OnboardingListing[];
  currency: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const showCostsStep = listings.length > 0 && listings.length <= SMALL_SHOP_THRESHOLD;

  async function saveVatAndAdvance(value: boolean) {
    setSaving(true);
    try {
      await fetch("/api/shop/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerHasValidVatId: value }),
      });
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  async function saveShippingAndAdvance(value: boolean) {
    setSaving(true);
    try {
      await fetch("/api/shop/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumeShippingNetZero: value }),
      });
      if (showCostsStep) {
        setStep(3);
      } else {
        await finish();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveCostsAndFinish() {
    setSaving(true);
    try {
      const entries = Object.entries(costs).filter(([, v]) => v.trim() !== "" && !Number.isNaN(Number(v)));
      await Promise.all(
        entries.map(([listingId, value]) =>
          fetch(`/api/listings/${listingId}/cogs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cogsAmount: Number(value), mode: "today" }),
          })
        )
      );
      await finish();
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    await fetch("/api/shop/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 480, margin: "60px auto", padding: "0 24px" }}>
      {step === 1 && (
        <>
          <h1 style={{ fontSize: "1.3rem", marginBottom: 8 }}>Do you have a valid VAT ID?</h1>
          <p style={{ color: "var(--muted)", marginBottom: 24 }}>
            This affects how Etsy&rsquo;s fees are taxed in your profit numbers. If you&rsquo;re
            not sure, choose &ldquo;No&rdquo; — you can change this anytime in Settings.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="button" onClick={() => saveVatAndAdvance(true)} disabled={saving}>
              Yes
            </button>
            <button type="button" className="button" onClick={() => saveVatAndAdvance(false)} disabled={saving}>
              No
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 style={{ fontSize: "1.3rem", marginBottom: 8 }}>
            Do you charge buyers exactly what shipping costs you?
          </h1>
          <p style={{ color: "var(--muted)", marginBottom: 24 }}>
            Most sellers don&rsquo;t — Etsy doesn&rsquo;t tell us what you actually paid for
            postage, so by default shipping counts as real revenue until you enter your real
            cost per order. If you deliberately charge buyers your exact postage cost, choose
            &ldquo;Yes&rdquo; and shipping will be treated as a net-zero line instead.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="button" onClick={() => saveShippingAndAdvance(true)} disabled={saving}>
              Yes
            </button>
            <button type="button" className="button" onClick={() => saveShippingAndAdvance(false)} disabled={saving}>
              No
            </button>
          </div>
        </>
      )}

      {step === 3 && showCostsStep && (
        <>
          <h1 style={{ fontSize: "1.3rem", marginBottom: 8 }}>What does each listing cost you to make?</h1>
          <p style={{ color: "var(--muted)", marginBottom: 24 }}>
            Materials, packaging — whatever you count. Leave any blank to fill in later on the
            Costs page; profit won&rsquo;t show for those until you do.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {listings.map((listing) => (
              <div key={listing.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{listing.title}</span>
                <span style={{ color: "var(--muted)" }}>{currencySymbol(currency)}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={costs[listing.id] ?? ""}
                  onChange={(e) => setCosts((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                  style={{
                    width: 90,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                  }}
                />
              </div>
            ))}
          </div>
          <button type="button" className="button" onClick={saveCostsAndFinish} disabled={saving}>
            {saving ? "Saving…" : "Finish"}
          </button>
        </>
      )}
    </main>
  );
}
