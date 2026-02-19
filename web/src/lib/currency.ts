// Currency code to symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  CAD: "$",
  AUD: "$",
  CHF: "Fr",
  KRW: "₩",
  SGD: "$",
  IDR: "Rp",
  MYR: "RM",
  THB: "฿",
  VND: "₫",
  PHP: "₱",
  BRL: "R$",
  MXN: "$",
};

/**
 * Get currency symbol for a currency code
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

/**
 * Format amount with currency symbol
 */
export function formatCurrency(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${num.toFixed(2)}`;
}

/**
 * Format amount with sign and currency symbol
 */
export function formatCurrencyWithSign(
  amount: number | string,
  currency: string,
  type: "income" | "expense"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  const sign = type === "income" ? "+" : "-";
  return `${sign}${symbol}${num.toFixed(2)}`;
}
