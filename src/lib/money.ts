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
