import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { createApi, createTestUser } from "./helpers";
import Decimal from "decimal.js";

describe("Financial Precision Tests", () => {
  let api: ReturnType<typeof createApi>;
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
    const { token, response } = await createTestUser();
    userId = response.data?.data?.user?.id;
    api = createApi(token);
  });

  describe("Decimal.js precision", () => {
    it("should correctly add 0.1 + 0.2 = 0.3 (floating-point precision test)", () => {
      // JavaScript Number: 0.1 + 0.2 = 0.30000000000000004
      // Decimal.js: 0.1 + 0.2 = 0.3
      const a = new Decimal("0.1");
      const b = new Decimal("0.2");
      const result = a.plus(b);

      expect(result.toString()).toBe("0.3");
      expect(result.eq("0.3")).toBe(true);
    });

    it("should handle precise subtraction", () => {
      const amount = new Decimal("100.00");
      const deduction = new Decimal("0.1");
      const result = amount.minus(deduction);

      expect(result.toString()).toBe("99.9");
    });

    it("should correctly compare decimal values", () => {
      const a = new Decimal("0.3");
      const b = new Decimal("0.1").plus("0.2");

      expect(a.eq(b)).toBe(true);
      expect(a.gt("0.2")).toBe(true);
      expect(a.lt("0.4")).toBe(true);
    });

    it("should handle Decimal.min correctly", () => {
      const a = new Decimal("100.50");
      const b = new Decimal("50.25");
      const min = Decimal.min(a, b);

      expect(min.toString()).toBe("50.25");
    });
  });

  describe("Auto-payment with precise amounts", () => {
    it("should allocate payments with precise decimal amounts", async () => {
      const cat = await api.post("/api/categories", { name: "CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "Test CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
      });
      const accountId = acc.data.data.id;

      // Create debt with precise monthly amount
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Test Debt",
        type: "installment",
        totalAmount: "10000",
        monthlyAmount: "100.33", // Precise decimal
      });

      // Create payment transaction
      await api.post("/api/transactions", {
        type: "expense",
        amount: "100.33",
        categoryId,
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].totalAmount).toBe("100.33");
      expect(data.data[0].allocations).toHaveLength(1);
      expect(data.data[0].allocations[0].amount).toBe("100.33");
    });

    it("should correctly split excess payment without precision errors", async () => {
      const cat = await api.post("/api/categories", { name: "CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "Test CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
      });
      const accountId = acc.data.data.id;

      // Create two debts with precise amounts that could cause precision issues
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt A",
        type: "installment",
        totalAmount: "10000",
        monthlyAmount: "33.33",
      });
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt B",
        type: "installment",
        totalAmount: "5000",
        monthlyAmount: "16.67",
      });

      // Pay total monthly (33.33 + 16.67 = 50.00)
      await api.post("/api/transactions", {
        type: "expense",
        amount: "50.00",
        categoryId,
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(1);

      const allocations = data.data[0].allocations;
      expect(allocations).toHaveLength(2);

      // Verify exact amounts without floating-point errors
      const totalAllocated = allocations.reduce(
        (sum: number, a: any) => new Decimal(sum).plus(a.amount).toNumber(),
        0
      );
      expect(new Decimal(totalAllocated).toFixed(2)).toBe("50.00");
    });

    it("should handle excess allocation with precise decimals", async () => {
      const cat = await api.post("/api/categories", { name: "CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "Test CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt A",
        type: "installment",
        totalAmount: "10000",
        monthlyAmount: "33.33",
      });
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt B",
        type: "installment",
        totalAmount: "5000",
        monthlyAmount: "16.67",
      });

      // Pay with excess: 50.00 monthly + 10.00 excess = 60.00
      await api.post("/api/transactions", {
        type: "expense",
        amount: "60.00",
        categoryId,
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(1);

      const allocations = data.data[0].allocations;
      expect(allocations).toHaveLength(2);

      // Debt A should get: 33.33 monthly + 10.00 excess = 43.33
      // Debt B should get: 16.67 monthly
      // Find by amount - Debt A has excess allocation
      const debtAAlloc = allocations.find((a: any) => a.amount === "43.33");
      expect(debtAAlloc).toBeDefined();

      // Debt B should have 16.67
      const debtBAlloc = allocations.find((a: any) => a.amount === "16.67");
      expect(debtBAlloc).toBeDefined();

      // Total should be exactly 60.00
      const total = new Decimal(debtAAlloc.amount).plus(debtBAlloc.amount);
      expect(total.toString()).toBe("60");
    });
  });
});
