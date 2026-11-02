/** Money is integer USD cents in the prototype ledger (USDC ~= USD). */
export function formatUSD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [dollars, cents = ""] = cleaned.split(".");
  const total = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100_000_000) return null;
  return total;
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Sponsor gas reimbursement per NEST-to-NEST transaction, charged on top in USDC. */
export const NETWORK_FEE_CENTS = 1;
