import { describe, it, expect } from "vitest";
import { getCurrencySymbol, formatNumber, formatCurrency, formatCurrencyWithSign } from "./currency";

describe("getCurrencySymbol", () => {
  it("returns $ for USD", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("returns correct symbols for major currencies", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("GBP")).toBe("£");
    expect(getCurrencySymbol("JPY")).toBe("¥");
    expect(getCurrencySymbol("INR")).toBe("₹");
    expect(getCurrencySymbol("KRW")).toBe("₩");
    expect(getCurrencySymbol("IDR")).toBe("Rp");
    expect(getCurrencySymbol("BRL")).toBe("R$");
    expect(getCurrencySymbol("CHF")).toBe("Fr");
    expect(getCurrencySymbol("THB")).toBe("฿");
    expect(getCurrencySymbol("VND")).toBe("₫");
    expect(getCurrencySymbol("PHP")).toBe("₱");
    expect(getCurrencySymbol("MYR")).toBe("RM");
  });

  it("returns the currency code for unknown currencies", () => {
    expect(getCurrencySymbol("XYZ")).toBe("XYZ");
    expect(getCurrencySymbol("ABC")).toBe("ABC");
  });
});

describe("formatNumber", () => {
  it("formats with 2 decimal places by default", () => {
    expect(formatNumber(1234.5)).toBe("1,234.50");
  });

  it("formats with custom decimal places", () => {
    expect(formatNumber(1234.5, 0)).toBe("1,235");
    expect(formatNumber(1234.5678, 3)).toBe("1,234.568");
  });

  it("returns 0.00 for null", () => {
    expect(formatNumber(null)).toBe("0.00");
  });

  it("returns 0.00 for undefined", () => {
    expect(formatNumber(undefined)).toBe("0.00");
  });

  it("returns 0.00 for NaN", () => {
    expect(formatNumber(NaN)).toBe("0.00");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0.00");
  });

  it("handles large numbers", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
  });

  it("handles negative numbers", () => {
    const result = formatNumber(-1234.56);
    expect(result).toContain("1,234.56");
  });
});

describe("formatCurrency", () => {
  it("formats amount with currency symbol", () => {
    expect(formatCurrency(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats string amount", () => {
    expect(formatCurrency("50.5", "EUR")).toBe("€50.50");
  });

  it("returns symbol + 0.00 for null", () => {
    expect(formatCurrency(null, "USD")).toBe("$0.00");
  });

  it("returns symbol + 0.00 for undefined", () => {
    expect(formatCurrency(undefined, "GBP")).toBe("£0.00");
  });

  it("returns symbol + 0.00 for NaN string", () => {
    expect(formatCurrency("not-a-number", "USD")).toBe("$0.00");
  });

  it("formats with unknown currency code as symbol", () => {
    expect(formatCurrency(100, "XYZ")).toBe("XYZ100.00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });
});

describe("formatCurrencyWithSign", () => {
  it("adds + for income", () => {
    expect(formatCurrencyWithSign(100, "USD", "income")).toBe("+$100.00");
  });

  it("adds - for expense", () => {
    expect(formatCurrencyWithSign(100, "USD", "expense")).toBe("-$100.00");
  });

  it("adds + for positive adjustment", () => {
    expect(formatCurrencyWithSign(100, "USD", "adjustment")).toBe("+$100.00");
  });

  it("no sign prefix for negative adjustment (negative sign from number)", () => {
    const result = formatCurrencyWithSign(-100, "USD", "adjustment");
    // formatNumber(-100) produces "-100.00" with locale formatting
    expect(result).toContain("$");
    expect(result).toContain("100.00");
  });

  it("returns symbol + 0.00 for null amount", () => {
    expect(formatCurrencyWithSign(null, "USD", "income")).toBe("$0.00");
  });

  it("returns symbol + 0.00 for NaN string", () => {
    expect(formatCurrencyWithSign("abc", "EUR", "expense")).toBe("€0.00");
  });

  it("uses absolute value for income/expense amounts", () => {
    // Even if a negative number is passed for income, it should show as positive with +
    expect(formatCurrencyWithSign(-50, "USD", "income")).toBe("+$50.00");
    expect(formatCurrencyWithSign(-50, "USD", "expense")).toBe("-$50.00");
  });

  it("formats with different currencies", () => {
    expect(formatCurrencyWithSign(1000, "IDR", "expense")).toBe("-Rp1,000.00");
    expect(formatCurrencyWithSign(5000, "JPY", "income")).toBe("+¥5,000.00");
  });

  it("handles string amounts", () => {
    expect(formatCurrencyWithSign("250.75", "USD", "expense")).toBe("-$250.75");
  });
});
