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
 * Format number with thousand separators
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format amount with currency symbol and thousand separators
 */
export function formatCurrency(amount: number | string, currency: string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${formatNumber(num)}`;
}

/**
 * Format amount with sign, currency symbol, and thousand separators
 */
export function formatCurrencyWithSign(
  amount: number | string,
  currency: string,
  type: "income" | "expense" | "adjustment"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = getCurrencySymbol(currency);
  
  if (type === "adjustment") {
    // For adjustments, sign depends on whether amount is positive or negative
    const sign = num >= 0 ? "+" : "";
    return `${sign}${symbol}${formatNumber(num)}`;
  }
  
  const sign = type === "income" ? "+" : "-";
  return `${sign}${symbol}${formatNumber(Math.abs(num))}`;
}
