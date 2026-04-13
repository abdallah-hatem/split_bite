/**
 * Currency formatting utilities
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  EGP: "EGP",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SAR: "SAR",
  AED: "AED",
};

/**
 * Format a number as currency string
 */
export function formatCurrency(
  amount: number,
  currency: string = "EGP"
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const formatted = Math.abs(amount).toFixed(2);

  if (amount < 0) {
    return `-${symbol} ${formatted}`;
  }
  return `${symbol} ${formatted}`;
}

/**
 * Format a number as a short currency string (no decimals if whole number)
 */
export function formatCurrencyShort(
  amount: number,
  currency: string = "EGP"
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const abs = Math.abs(amount);
  const formatted = abs % 1 === 0 ? abs.toString() : abs.toFixed(2);

  if (amount < 0) {
    return `-${symbol} ${formatted}`;
  }
  return `${symbol} ${formatted}`;
}
