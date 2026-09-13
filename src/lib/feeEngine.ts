// MarginSnap — Etsy fee engine.
//
// A pure function: a normalized order in, a full Etsy fee breakdown out.
// No I/O, no Prisma, no fetch, no Date.now() — same input always gives the
// same output, so it's cheap to unit-test and safe to run in the browser,
// a cron job, or a CSV-driven test harness alike.
//
// Deliberately takes a NormalizedOrderInput, not a raw Etsy /receipts
// response — this is the seam a future adapter layer sits behind (an
// EtsyApiAdapter mapping Etsy's wire format to this shape; a CSV adapter for
// local testing). The engine itself never needs to know which one produced
// its input.
//
// Every rate below is sourced from Etsy's own published fee pages, current
// as of September 2026. Etsy revises these periodically (the Regulatory
// Operating Fee table below was last revised 22 Jun 2026) — re-verify
// against the cited pages if numbers look off, and update FEES_AS_OF.
//
// Sources:
// - Fees & Payments Policy: https://www.etsy.com/legal/fees/
// - Etsy Fee Basics: https://help.etsy.com/hc/en-us/articles/360035902374-Etsy-Fee-Basics
// - Fees and Listing Multiple Quantities: https://help.etsy.com/hc/en-us/articles/360000344908-Fees-and-Listing-Multiple-Quantities
// - Payment Processing Fees: https://help.etsy.com/hc/en-us/articles/115015628847-What-are-Payment-Processing-Fees-for-Selling-on-Etsy
// - How Etsy's Offsite Ads Work: https://help.etsy.com/hc/en-us/articles/360000338367-How-Etsy-s-Offsite-Ads-Work
// - What is a Regulatory Operating Fee: https://help.etsy.com/hc/en-us/articles/1500011073202-What-is-a-Regulatory-Operating-Fee
// - Custom Fees and Physical VAT Collection: https://help.etsy.com/hc/en-us/articles/360000337247-Custom-Fees-and-Physical-VAT-Collection
// - VAT on Etsy seller fees (UK mechanics — registered vs unregistered, reverse charge): https://www.a2xaccounting.com/ecommerce-accounting-hub/etsy-vat-seller-fees
// - EU/UK standard VAT rates: https://taxfoundation.org/data/all/eu/value-added-tax-vat-rates-europe/

export const FEES_AS_OF = "2026-09-13";

// ---------------------------------------------------------------------------
// Rate tables
// ---------------------------------------------------------------------------

/** 6.5% of item price + shipping + gift wrap (US sales tax excluded; non-US
 * taxes included). Source: etsy.com/legal/fees */
export const TRANSACTION_FEE_RATE = 0.065;

/** $0.20 USD per listing, charged once regardless of listed quantity; the
 * per-order MULTI_QUANTITY_FEE_USD below covers additional units sold.
 * Source: help.etsy.com Etsy-Fee-Basics. Not itself an order-level fee (it
 * fires on listing creation/renewal, every 4 months or on full sell-through)
 * so it is not part of this engine's per-order breakdown — see the header
 * note in feeEngine.test.ts. */
export const LISTING_FEE_USD = 0.20;

/** Multi-quantity fee: for a listing with quantity > 1, the base listing fee
 * covers only the first unit sold; every additional unit sold is billed this
 * amount. Source: help.etsy.com Fees-and-Listing-Multiple-Quantities (10-bowl
 * example: $0.20 initial + $1.80 for the other 9 = $2.00 total). */
export const MULTI_QUANTITY_FEE_USD = 0.20;

/** Offsite Ads. Standard rate for shops under the trailing-365-day threshold;
 * reduced rate — mandatory, lifetime — once a shop crosses it. Fee never
 * exceeds the per-order cap. Source: help.etsy.com How-Etsy's-Offsite-Ads-Work */
export const OFFSITE_ADS_STANDARD_RATE = 0.15;
export const OFFSITE_ADS_REDUCED_RATE = 0.12;
export const OFFSITE_ADS_THRESHOLD_USD = 10_000;
export const OFFSITE_ADS_PER_ORDER_CAP_USD = 100;

/** Charged when a listing's currency differs from the seller's Etsy Payments
 * account currency. Source: etsy.com/legal/fees */
export const CURRENCY_CONVERSION_FEE_RATE = 0.025;

/** Payment processing: percent + fixed fee per order, on item + shipping +
 * tax. Fixed fee is in the seller's local payment-account currency — this
 * engine assumes `input.currency` already matches that currency (true for
 * every test case below, and for the common case of a seller listing in
 * their own home currency). If a seller lists in a currency other than their
 * payment account's, convert amounts (and the fixed fee) to a common
 * currency before calling this engine — this table does not do FX.
 * Source: help.etsy.com Payment-Processing-Fees, cross-checked against
 * etsy.com/legal/fees. */
export interface PaymentProcessingRate {
  percent: number;
  fixed: number;
  fixedCurrency: string;
}

export const PAYMENT_PROCESSING_FEES: Record<string, PaymentProcessingRate> = {
  US: { percent: 0.03, fixed: 0.25, fixedCurrency: "USD" },
  CA: { percent: 0.03, fixed: 0.25, fixedCurrency: "CAD" },
  AU: { percent: 0.03, fixed: 0.25, fixedCurrency: "AUD" },
  GB: { percent: 0.04, fixed: 0.20, fixedCurrency: "GBP" },
  DK: { percent: 0.04, fixed: 2.50, fixedCurrency: "DKK" },
  SE: { percent: 0.04, fixed: 3.00, fixedCurrency: "SEK" },
  CH: { percent: 0.04, fixed: 0.50, fixedCurrency: "CHF" },
  NO: { percent: 0.04, fixed: 2.50, fixedCurrency: "NOK" },
  JP: { percent: 0.06, fixed: 0.30, fixedCurrency: "USD" },
  SG: { percent: 0.044, fixed: 0.35, fixedCurrency: "SGD" },
};

/** Eurozone standard rate (4% + €0.30) — applied to every EU/eurozone
 * country not given its own row above. Source: help.etsy.com
 * Payment-Processing-Fees. */
export const EUROZONE_PAYMENT_PROCESSING_FEE: PaymentProcessingRate = {
  percent: 0.04,
  fixed: 0.30,
  fixedCurrency: "EUR",
};

const EUROZONE_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES",
]);

export function paymentProcessingRateFor(sellerCountry: string): PaymentProcessingRate | undefined {
  if (PAYMENT_PROCESSING_FEES[sellerCountry]) return PAYMENT_PROCESSING_FEES[sellerCountry];
  if (EUROZONE_COUNTRIES.has(sellerCountry)) return EUROZONE_PAYMENT_PROCESSING_FEE;
  return undefined;
}

/** Regulatory Operating Fee: a percentage of item price + shipping (+ gift
 * wrap/personalization), charged in addition to the transaction fee, in the
 * countries below only. Everywhere else the rate is 0. Last revised by Etsy
 * 22 Jun 2026 — these are currency-agnostic percentages recalculated
 * periodically, so re-check before relying on them long-term.
 * Source: help.etsy.com What-is-a-Regulatory-Operating-Fee */
export const REGULATORY_OPERATING_FEE_RATES: Record<string, number> = {
  GB: 0.0048,
  FR: 0.0114,
  IT: 0.0080,
  ES: 0.0088,
  HU: 0.0197,
  TR: 0.0167,
  VN: 0.0124,
  CA: 0.0050,
  IN: 0.0005,
};

export function regulatoryOperatingFeeRateFor(sellerCountry: string): number {
  return REGULATORY_OPERATING_FEE_RATES[sellerCountry] ?? 0;
}

/** Standard VAT rates, EU + UK. Etsy (an Irish/UK entity for these purposes)
 * charges VAT on seller fees — listing, transaction, payment processing,
 * multi-quantity, Offsite Ads — at the seller's local rate UNLESS the seller
 * has a valid VAT ID on file, in which case the reverse charge applies and
 * Etsy adds no VAT (the seller self-accounts for it instead, net zero).
 * Not exhaustive outside the EU/UK (e.g. Norway, Switzerland, Singapore also
 * have VAT/GST regimes Etsy may apply — add rows here as needed).
 * Sources: help.etsy.com Custom-Fees-and-Physical-VAT-Collection (VAT is
 * collected on fees where required); a2xaccounting.com (registered sellers
 * get reverse charge, no VAT added); taxfoundation.org (rates). */
export const VAT_STANDARD_RATES: Record<string, number> = {
  AT: 0.20, BE: 0.21, BG: 0.20, HR: 0.25, CY: 0.19, CZ: 0.21, DK: 0.25,
  EE: 0.24, FI: 0.255, FR: 0.20, DE: 0.19, GR: 0.24, HU: 0.27, IE: 0.23,
  IT: 0.22, LV: 0.21, LT: 0.21, LU: 0.17, MT: 0.18, NL: 0.21, PL: 0.23,
  PT: 0.23, RO: 0.21, SK: 0.23, SI: 0.22, ES: 0.21, SE: 0.25, GB: 0.20,
};

export function vatOnFeesApplies(sellerCountry: string): boolean {
  return sellerCountry in VAT_STANDARD_RATES;
}

// ---------------------------------------------------------------------------
// Engine input / output
// ---------------------------------------------------------------------------

export interface FeeEngineLineItem {
  listingId: string;
  quantity: number;
  /** Per-unit price, in `currency`, major units (e.g. dollars — not cents). */
  unitPrice: number;
  /**
   * True if this line item includes the very first unit ever sold from this
   * listing — i.e. no MULTI_QUANTITY_FEE_USD has been billed against it
   * before. Etsy only charges the multi-quantity fee for units beyond that
   * first one (see MULTI_QUANTITY_FEE_USD). Tracking which unit is "first"
   * across a listing's lifetime is the sync/DB layer's job — the engine just
   * needs the flag for this line item.
   */
  isFirstUnitSoldOnListing: boolean;
}

export interface FeeEngineInput {
  /** ISO 4217 order/listing currency, e.g. "USD" "GBP" "EUR". */
  currency: string;
  lineItems: FeeEngineLineItem[];
  shippingCharged: number;
  giftWrapCharged?: number;

  /** ISO 3166-1 alpha-2 country of the seller's Etsy Payments account —
   * drives payment processing rate, Regulatory Operating Fee, and (with
   * sellerHasValidVatId) VAT on fees. */
  sellerCountry: string;

  /** true → Etsy applies the reverse charge and adds no VAT to fees (the
   * seller self-accounts). false → Etsy adds VAT on fees at the seller's
   * local rate, where vatOnFeesApplies(sellerCountry). */
  sellerHasValidVatId: boolean;

  /** ISO 4217 currency of the seller's Etsy Payments account. Omit it, or
   * set it equal to `currency`, when the seller lists in their own payment
   * currency (the common case, and every test case below) — the currency
   * conversion fee only fires when the two differ. When they do differ,
   * this engine charges 2.5% of the order total in `currency` (matching how
   * Etsy itself takes the fee, before any FX conversion) — no FX rate is
   * needed for the fee calculation itself. */
  paymentAccountCurrency?: string;

  /** Was this sale attributed to an Offsite Ads click? */
  offsiteAdsAttributed: boolean;

  /** Shop's trailing-365-day sales, converted to USD the way Etsy does it —
   * decides the 12% vs 15% Offsite Ads rate. Only read when
   * offsiteAdsAttributed is true. */
  shopTrailing365dSalesUsd?: number;
}

export interface FeeEngineBreakdown {
  itemTotal: number;
  shippingTotal: number;
  giftWrapTotal: number;
  /** item + shipping + gift wrap — the base most percentage fees apply to. */
  orderTotal: number;

  transactionFee: number;
  paymentProcessingFee: number;
  multiQuantityFee: number;
  offsiteAdsFee: number;
  currencyConversionFee: number;
  regulatoryOperatingFee: number;

  /** VAT added on top of the six fee lines above, when applicable. Zero when
   * the seller has a valid VAT ID (reverse charge) or is outside the
   * VAT_STANDARD_RATES table. */
  vatOnFees: number;

  /** Sum of every fee line above, VAT included. */
  totalFees: number;

  /** orderTotal - totalFees. Does not subtract COGS — that's a separate,
   * caller-side step once cost-of-goods is known. */
  netToSeller: number;

  /** Which rate-table rows were actually used, for debugging/display. */
  ratesUsed: {
    transactionFeeRate: number;
    paymentProcessingRate: PaymentProcessingRate | null;
    regulatoryOperatingFeeRate: number;
    offsiteAdsRate: number | null;
    vatRate: number | null;
    currencyConversionFeeRate: number | null;
  };
}

function round2(n: number): number {
  // Banker's-rounding-free, good enough for display money math; the sync
  // layer should reconcile against Etsy's own reported fee figures rather
  // than trust floating point over a long history.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute the full Etsy fee breakdown for one order. Pure: no I/O, same
 * input always produces the same output.
 */
export function computeOrderFees(input: FeeEngineInput): FeeEngineBreakdown {
  const itemTotal = round2(
    input.lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0)
  );
  const shippingTotal = round2(input.shippingCharged);
  const giftWrapTotal = round2(input.giftWrapCharged ?? 0);
  const orderTotal = round2(itemTotal + shippingTotal + giftWrapTotal);

  // ---- Transaction fee: 6.5% of item + shipping + gift wrap ----
  const transactionFee = round2(orderTotal * TRANSACTION_FEE_RATE);

  // ---- Payment processing: percent + fixed, on item + shipping (+ tax,
  // which this engine doesn't model separately — pass it in shippingCharged/
  // itemPrice if you need it reflected) ----
  const paymentRate = paymentProcessingRateFor(input.sellerCountry) ?? null;
  const paymentProcessingFee = paymentRate
    ? round2(orderTotal * paymentRate.percent + paymentRate.fixed)
    : 0;

  // ---- Multi-quantity fee: $0.20 for every unit beyond the first sold on
  // a listing ----
  const multiQuantityFee = round2(
    input.lineItems.reduce((sum, li) => {
      const billableExtraUnits = Math.max(0, li.quantity - (li.isFirstUnitSoldOnListing ? 1 : 0));
      return sum + billableExtraUnits * MULTI_QUANTITY_FEE_USD;
    }, 0)
  );

  // ---- Offsite Ads ----
  let offsiteAdsRate: number | null = null;
  let offsiteAdsFee = 0;
  if (input.offsiteAdsAttributed) {
    offsiteAdsRate =
      (input.shopTrailing365dSalesUsd ?? 0) >= OFFSITE_ADS_THRESHOLD_USD
        ? OFFSITE_ADS_REDUCED_RATE
        : OFFSITE_ADS_STANDARD_RATE;
    offsiteAdsFee = round2(Math.min(orderTotal * offsiteAdsRate, OFFSITE_ADS_PER_ORDER_CAP_USD));
  }

  // ---- Currency conversion: 2.5% of order total when the listing currency
  // differs from the seller's payment-account currency ----
  const currencyConversionApplies = Boolean(
    input.paymentAccountCurrency && input.paymentAccountCurrency !== input.currency
  );
  const currencyConversionFee = currencyConversionApplies
    ? round2(orderTotal * CURRENCY_CONVERSION_FEE_RATE)
    : 0;

  // ---- Regulatory Operating Fee: on item + shipping (+ gift wrap), country
  // table only ----
  const regulatoryOperatingFeeRate = regulatoryOperatingFeeRateFor(input.sellerCountry);
  const regulatoryOperatingFee = round2(orderTotal * regulatoryOperatingFeeRate);

  // ---- VAT on fees ----
  const feesSubjectToVat =
    transactionFee + paymentProcessingFee + multiQuantityFee + offsiteAdsFee +
    currencyConversionFee + regulatoryOperatingFee;
  const vatRate =
    !input.sellerHasValidVatId && vatOnFeesApplies(input.sellerCountry)
      ? VAT_STANDARD_RATES[input.sellerCountry]
      : null;
  const vatOnFees = vatRate ? round2(feesSubjectToVat * vatRate) : 0;

  const totalFees = round2(feesSubjectToVat + vatOnFees);
  const netToSeller = round2(orderTotal - totalFees);

  return {
    itemTotal,
    shippingTotal,
    giftWrapTotal,
    orderTotal,
    transactionFee,
    paymentProcessingFee,
    multiQuantityFee,
    offsiteAdsFee,
    currencyConversionFee,
    regulatoryOperatingFee,
    vatOnFees,
    totalFees,
    netToSeller,
    ratesUsed: {
      transactionFeeRate: TRANSACTION_FEE_RATE,
      paymentProcessingRate: paymentRate,
      regulatoryOperatingFeeRate,
      offsiteAdsRate,
      vatRate,
      currencyConversionFeeRate: currencyConversionApplies ? CURRENCY_CONVERSION_FEE_RATE : null,
    },
  };
}
