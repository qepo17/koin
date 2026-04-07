import { useQuery } from "@tanstack/react-query";
import { settings } from "../lib/api";

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

export function useCurrency() {
  const { data: userSettings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await settings.get();
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const currency = userSettings?.currency ?? "USD";
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";

  const formatAmount = (amount: number): string => {
    const absAmount = Math.abs(amount);
    
    // Format based on currency
    if (currency === "IDR" || currency === "VND") {
      // No decimals for these currencies
      return `${symbol} ${absAmount.toLocaleString()}`;
    }
    
    return `${symbol} ${absAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return {
    currency,
    symbol,
    formatAmount,
  };
}
