// MarginSnap — fee engine tests.
//
// Uses Node's built-in test runner (node:test / node:assert) — no new test
// framework dependency, just a way to execute TypeScript directly. Run with:
//   npx tsx --test src/lib/feeEngine.test.ts
// (tsx is fetched on demand by npx; nothing is added to package.json here —
// wire up a permanent `npm test` script only if/when you want one.)
//
// On Node 22+ you can instead run it with zero extra tooling via native type
// stripping, but that requires explicit .ts extensions on relative imports
// (Node ESM's rule, not this project's) — swap the import above to
// "./feeEngine.ts" if you go that route:
//   node --experimental-strip-types --test src/lib/feeEngine.test.ts
//
// Each case prints its full breakdown via console.table so the numbers can
// be eyeballed against Etsy's own numbers on a real receipt, not just
// checked against the assertions below.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOrderFees, type FeeEngineInput } from "./feeEngine";

function show(label: string, input: FeeEngineInput) {
  const result = computeOrderFees(input);
  console.log(`\n=== ${label} ===`);
  console.table({
    "Item total": result.itemTotal,
    "Shipping": result.shippingTotal,
    "Gift wrap": result.giftWrapTotal,
    "Order total": result.orderTotal,
    "Transaction fee (6.5%)": result.transactionFee,
    "Payment processing": result.paymentProcessingFee,
    "Multi-quantity fee": result.multiQuantityFee,
    "Offsite Ads fee": result.offsiteAdsFee,
    "Currency conversion fee": result.currencyConversionFee,
    "Regulatory operating fee": result.regulatoryOperatingFee,
    "VAT on fees": result.vatOnFees,
    "Total fees": result.totalFees,
    "Net to seller": result.netToSeller,
  });
  return result;
}

// ---------------------------------------------------------------------------
// 1. US order — the baseline: no VAT, no Regulatory Operating Fee, no Offsite
// Ads, single quantity.
// ---------------------------------------------------------------------------
test("US order — baseline", () => {
  const input: FeeEngineInput = {
    currency: "USD",
    lineItems: [{ listingId: "L1", quantity: 1, unitPrice: 40.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 5.5,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: false,
  };
  const r = show("US order", input);

  assert.equal(r.orderTotal, 45.5);
  assert.equal(r.transactionFee, round2(45.5 * 0.065)); // 2.96
  assert.equal(r.paymentProcessingFee, round2(45.5 * 0.03 + 0.25)); // 1.62
  assert.equal(r.multiQuantityFee, 0);
  assert.equal(r.offsiteAdsFee, 0);
  assert.equal(r.currencyConversionFee, 0);
  assert.equal(r.regulatoryOperatingFee, 0); // US has no Regulatory Operating Fee
  assert.equal(r.vatOnFees, 0); // US isn't in the VAT-on-fees table
  assert.equal(r.totalFees, round2(r.transactionFee + r.paymentProcessingFee));
});

// ---------------------------------------------------------------------------
// 2. UK order — GB Regulatory Operating Fee + UK payment processing rate,
// seller HAS a valid VAT ID → reverse charge, so VAT on fees is 0 even
// though sellerCountry is in the VAT table.
// ---------------------------------------------------------------------------
test("UK order — VAT-registered seller (reverse charge)", () => {
  const input: FeeEngineInput = {
    currency: "GBP",
    lineItems: [{ listingId: "L2", quantity: 1, unitPrice: 28.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 3.5,
    sellerCountry: "GB",
    sellerHasValidVatId: true, // <- reverse charge
    offsiteAdsAttributed: false,
  };
  const r = show("UK order (VAT-registered)", input);

  assert.equal(r.orderTotal, 31.5);
  assert.equal(r.transactionFee, round2(31.5 * 0.065)); // 2.05
  assert.equal(r.paymentProcessingFee, round2(31.5 * 0.04 + 0.2)); // 1.46
  assert.equal(r.regulatoryOperatingFee, round2(31.5 * 0.0048)); // 0.15
  assert.equal(r.vatOnFees, 0, "valid VAT ID means Etsy applies the reverse charge, not VAT");
  assert.equal(
    r.totalFees,
    round2(r.transactionFee + r.paymentProcessingFee + r.regulatoryOperatingFee)
  );
});

// ---------------------------------------------------------------------------
// 3. EU order with VAT — Germany, seller has NO VAT ID on file → Etsy adds
// German VAT (19%) on top of the fees. Germany has no Regulatory Operating
// Fee, isolating the VAT-on-fees math from that other line.
// ---------------------------------------------------------------------------
test("EU order with VAT — DE, VAT-unregistered seller", () => {
  const input: FeeEngineInput = {
    currency: "EUR",
    lineItems: [{ listingId: "L3", quantity: 1, unitPrice: 32.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 4.0,
    sellerCountry: "DE",
    sellerHasValidVatId: false, // <- VAT applies to fees
    offsiteAdsAttributed: false,
  };
  const r = show("EU order with VAT (DE, unregistered)", input);

  assert.equal(r.orderTotal, 36.0);
  assert.equal(r.transactionFee, round2(36.0 * 0.065)); // 2.34
  assert.equal(r.paymentProcessingFee, round2(36.0 * 0.04 + 0.3)); // 1.74
  assert.equal(r.regulatoryOperatingFee, 0); // Germany has no Regulatory Operating Fee
  const feesSubjectToVat = r.transactionFee + r.paymentProcessingFee;
  assert.equal(r.vatOnFees, round2(feesSubjectToVat * 0.19)); // German standard VAT
  assert.equal(r.totalFees, round2(feesSubjectToVat + r.vatOnFees));
});

// ---------------------------------------------------------------------------
// 4. Multi-quantity sale — 5 units sold in one order from a brand-new
// listing: 1 unit covered by the base listing fee, 4 billed at $0.20 each.
// ---------------------------------------------------------------------------
test("Multi-quantity sale — 5 units, first sale on the listing", () => {
  const input: FeeEngineInput = {
    currency: "USD",
    lineItems: [{ listingId: "L4", quantity: 5, unitPrice: 8.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 6.0,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: false,
  };
  const r = show("Multi-quantity sale (5 units)", input);

  assert.equal(r.itemTotal, 40.0);
  assert.equal(r.multiQuantityFee, round2(4 * 0.2)); // 0.80 — 4 units beyond the first
});

test("Multi-quantity sale — 3 units, NOT the first sale on the listing", () => {
  // Two units already sold previously (and already billed) — every unit in
  // this order is "extra", so all 3 are billed at $0.20 each.
  const input: FeeEngineInput = {
    currency: "USD",
    lineItems: [{ listingId: "L4", quantity: 3, unitPrice: 8.0, isFirstUnitSoldOnListing: false }],
    shippingCharged: 4.0,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: false,
  };
  const r = show("Multi-quantity sale (3 more units, listing already sold from)", input);

  assert.equal(r.multiQuantityFee, round2(3 * 0.2)); // 0.60
});

// ---------------------------------------------------------------------------
// 5. Offsite Ads sale — standard 15% rate (shop under the $10k/365d
// threshold).
// ---------------------------------------------------------------------------
test("Offsite Ads sale — 15% (shop under $10k trailing 365d)", () => {
  const input: FeeEngineInput = {
    currency: "USD",
    lineItems: [{ listingId: "L5", quantity: 1, unitPrice: 60.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 0,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: true,
    shopTrailing365dSalesUsd: 4000,
  };
  const r = show("Offsite Ads sale — 15% rate", input);

  assert.equal(r.ratesUsed.offsiteAdsRate, 0.15);
  assert.equal(r.offsiteAdsFee, round2(60.0 * 0.15)); // 9.00
});

// ---------------------------------------------------------------------------
// 6. Offsite Ads sale — reduced 12% rate (shop at/over the $10k/365d
// threshold), plus a check that the $100 per-order cap actually binds on a
// large order.
// ---------------------------------------------------------------------------
test("Offsite Ads sale — 12% (shop at/over $10k trailing 365d)", () => {
  const input: FeeEngineInput = {
    currency: "USD",
    lineItems: [{ listingId: "L6", quantity: 1, unitPrice: 60.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 0,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: true,
    shopTrailing365dSalesUsd: 25_000,
  };
  const r = show("Offsite Ads sale — 12% rate", input);

  assert.equal(r.ratesUsed.offsiteAdsRate, 0.12);
  assert.equal(r.offsiteAdsFee, round2(60.0 * 0.12)); // 7.20
});

test("Offsite Ads fee is capped at $100 per order even on a large sale", () => {
  const input: FeeEngineInput = {
    currency: "USD",
    lineItems: [{ listingId: "L7", quantity: 1, unitPrice: 900.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 0,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: true,
    shopTrailing365dSalesUsd: 25_000, // 12% rate — 12% of 900 would be $108, over the cap
  };
  const r = show("Offsite Ads sale — $100 cap check", input);

  assert.equal(r.offsiteAdsFee, 100);
});

// ---------------------------------------------------------------------------
// Bonus: currency conversion fee — listing currency differs from the
// seller's Etsy Payments account currency. Not one of the required scenarios
// but worth a check since it's part of the researched fee schedule and the
// breakdown carries a dedicated field for it.
// ---------------------------------------------------------------------------
test("Currency conversion fee — listing currency differs from payment account currency", () => {
  const input: FeeEngineInput = {
    currency: "GBP",
    lineItems: [{ listingId: "L8", quantity: 1, unitPrice: 20.0, isFirstUnitSoldOnListing: true }],
    shippingCharged: 0,
    sellerCountry: "US",
    sellerHasValidVatId: false,
    offsiteAdsAttributed: false,
    paymentAccountCurrency: "USD", // shop's payment account is USD, listing is priced in GBP
  };
  const r = show("Currency conversion fee (GBP listing, USD payment account)", input);

  assert.equal(r.currencyConversionFee, round2(20.0 * 0.025)); // 0.50
});

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
