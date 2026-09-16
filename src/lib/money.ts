// Shared money/percent formatting — Intl-based, never a hand-picked symbol
// table, so every currency Etsy could report (and every fee rate the engine
// computes) displays correctly without us maintaining a lookup ourselves.

/**
 * Formats an amount in its order's real currency. `currency` is null only
 * for rows synced before that column existed — shown as a bare number
 * rather than assuming a currency for them.
 */
export function formatMoney(amount: number, currency: string | null): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Formats a rate (e.g. 0.065) as "6.5%" — used to show which rate applied
 * alongside each fee-breakdown line, the way Sellerboard shows its fee
 * detail. */
export function formatPercent(rate: number): string {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 3 }).format(rate);
}

/**
 * Just the symbol ("€", "$", "£"...) for an input-field prefix — same
 * Intl-based approach as formatMoney, so an editable-cost input never shows
 * a hardcoded "$" next to numbers that are actually in the order's real
 * currency (found 2026-09-16: ShippingCostEditor/CogsEditor had a literal
 * "$" span regardless of the shop's currency). Falls back to "$" only when
 * currency is null (rows synced before that column existed).
 */
export function currencySymbol(currency: string | null): string {
  if (!currency) return "$";
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
