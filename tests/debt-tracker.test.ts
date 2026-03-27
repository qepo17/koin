import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { createApi, createTestUser, createTestUserDirect } from "./helpers";

describe("Debt Tracker API", () => {
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

  // --- Debt Accounts ---

  describe("POST /api/debt-accounts", () => {
    it("should create a debt account", async () => {
      const { status, data } = await api.post("/api/debt-accounts", {
        name: "BRI Credit Card",
        type: "credit_card",
        creditor: "BRI",
        creditLimit: "50000000.00",
        billingDay: 20,
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        name: "BRI Credit Card",
        type: "credit_card",
        creditor: "BRI",
        creditLimit: "50000000.00",
        billingDay: 20,
        autoTrack: true,
        status: "active",
      });
      expect(data.data.id).toBeDefined();
    });

    it("should create a loan account", async () => {
      const { status, data } = await api.post("/api/debt-accounts", {
        name: "Home Mortgage",
        type: "loan",
        creditor: "Bank ABC",
        billingDay: 1,
        description: "30-year mortgage",
      });

      expect(status).toBe(201);
      expect(data.data.type).toBe("loan");
    });

    it("should create account with linked category", async () => {
      const cat = await api.post("/api/categories", { name: "Credit Card Bills" });
      const categoryId = cat.data.data.id;

      const { status, data } = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
      });

      expect(status).toBe(201);
      expect(data.data.categoryId).toBe(categoryId);
    });

    it("should reject invalid billing day", async () => {
      const { status } = await api.post("/api/debt-accounts", {
        name: "Test",
        type: "credit_card",
        billingDay: 32,
      });
      expect(status).toBe(400);
    });

    it("should reject missing required fields", async () => {
      const { status } = await api.post("/api/debt-accounts", {
        name: "Test",
      });
      expect(status).toBe(400);
    });

    it("should reject unauthenticated requests", async () => {
      const unauthApi = createApi();
      const { status } = await unauthApi.post("/api/debt-accounts", {
        name: "Test",
        type: "credit_card",
        billingDay: 1,
      });
      expect(status).toBe(401);
    });
  });

  describe("GET /api/debt-accounts", () => {
    it("should list debt accounts with computed totals", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });

      await api.post(`/api/debt-accounts/${acc.data.data.id}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      const { status, data } = await api.get("/api/debt-accounts");
      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].totalDebt).toBe("18000000.00");
      expect(data.data[0].monthlyCommitment).toBe("1500000.00");
      expect(data.data[0].debtsCount).toBe(1);
    });

    it("should filter by status", async () => {
      await api.post("/api/debt-accounts", {
        name: "Active CC",
        type: "credit_card",
        billingDay: 15,
      });

      const { data } = await api.get("/api/debt-accounts?status=active");
      expect(data.data).toHaveLength(1);

      const { data: closedData } = await api.get("/api/debt-accounts?status=closed");
      expect(closedData.data).toHaveLength(0);
    });

    it("should filter by type", async () => {
      await api.post("/api/debt-accounts", { name: "CC", type: "credit_card", billingDay: 20 });
      await api.post("/api/debt-accounts", { name: "Loan", type: "loan", billingDay: 1 });

      const { data } = await api.get("/api/debt-accounts?type=loan");
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Loan");
    });

    it("should not return other users' accounts", async () => {
      await api.post("/api/debt-accounts", { name: "My CC", type: "credit_card", billingDay: 20 });

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      const { data } = await otherApi.get("/api/debt-accounts");
      expect(data.data).toHaveLength(0);
    });
  });

  describe("GET /api/debt-accounts/:id", () => {
    it("should get account detail with debts and payments", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      const { status, data } = await api.get(`/api/debt-accounts/${accountId}`);
      expect(status).toBe(200);
      expect(data.data.debts).toHaveLength(1);
      expect(data.data.recentPayments).toBeDefined();
    });

    it("should return 404 for non-existent account", async () => {
      const { status } = await api.get("/api/debt-accounts/00000000-0000-0000-0000-000000000000");
      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/debt-accounts/:id", () => {
    it("should update account", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "Old Name",
        type: "credit_card",
        billingDay: 20,
      });

      const { status, data } = await api.patch(`/api/debt-accounts/${acc.data.data.id}`, {
        name: "New Name",
        creditor: "BRI",
      });

      expect(status).toBe(200);
      expect(data.data.name).toBe("New Name");
      expect(data.data.creditor).toBe("BRI");
    });

    it("should return 404 for non-existent account", async () => {
      const { status } = await api.patch("/api/debt-accounts/00000000-0000-0000-0000-000000000000", {
        name: "Test",
      });
      expect(status).toBe(404);
    });
  });

  describe("DELETE /api/debt-accounts/:id", () => {
    it("should soft-close an account with no active debts", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });

      const { status, data } = await api.delete(`/api/debt-accounts/${acc.data.data.id}`);
      expect(status).toBe(200);
      expect(data.data.status).toBe("closed");
    });

    it("should reject closing account with active debts", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });

      await api.post(`/api/debt-accounts/${acc.data.data.id}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      const { status, data } = await api.delete(`/api/debt-accounts/${acc.data.data.id}`);
      expect(status).toBe(400);
      expect(data.error).toBe("Cannot close account with active debts");
    });

    it("should allow closing account after debts are cancelled", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      const debt = await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      // Cancel the debt
      await api.delete(`/api/debt-accounts/${accountId}/debts/${debt.data.data.id}`);

      // Now closing should work
      const { status, data } = await api.delete(`/api/debt-accounts/${accountId}`);
      expect(status).toBe(200);
      expect(data.data.status).toBe("closed");
    });
  });

  // --- Debts ---

  describe("POST /api/debt-accounts/:accountId/debts", () => {
    it("should create an installment debt", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });

      const { status, data } = await api.post(`/api/debt-accounts/${acc.data.data.id}/debts`, {
        name: "iPhone 16 Pro",
        type: "installment",
        totalAmount: "18000000.00",
        monthlyAmount: "1500000.00",
        installmentMonths: 12,
        installmentStart: "2026-01-20T00:00:00Z",
        description: "12x 0% installment",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        name: "iPhone 16 Pro",
        type: "installment",
        totalAmount: "18000000.00",
        monthlyAmount: "1500000.00",
        installmentMonths: 12,
        status: "active",
      });
    });

    it("should create a revolving debt", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });

      const { status, data } = await api.post(`/api/debt-accounts/${acc.data.data.id}/debts`, {
        name: "Revolving Balance",
        type: "revolving",
        totalAmount: "5000000",
        monthlyAmount: "500000",
        interestRate: "2.5",
      });

      expect(status).toBe(201);
      expect(data.data.interestRate).toBe("2.50");
    });

    it("should reject if account not found", async () => {
      const { status } = await api.post("/api/debt-accounts/00000000-0000-0000-0000-000000000000/debts", {
        name: "Test",
        type: "installment",
        totalAmount: "1000",
        monthlyAmount: "100",
      });
      expect(status).toBe(404);
    });

    it("should reject negative amounts", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "Test",
        type: "credit_card",
        billingDay: 1,
      });

      const { status } = await api.post(`/api/debt-accounts/${acc.data.data.id}/debts`, {
        name: "Test",
        type: "installment",
        totalAmount: "-1000",
        monthlyAmount: "100",
      });
      expect(status).toBe(400);
    });
  });

  describe("GET /api/debt-accounts/:accountId/debts", () => {
    it("should list debts for an account", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Laptop",
        type: "installment",
        totalAmount: "12000000",
        monthlyAmount: "1000000",
      });

      const { status, data } = await api.get(`/api/debt-accounts/${accountId}/debts`);
      expect(status).toBe(200);
      expect(data.data).toHaveLength(2);
    });

    it("should filter by status", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      const debt = await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      // Cancel one
      await api.delete(`/api/debt-accounts/${accountId}/debts/${debt.data.data.id}`);

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Laptop",
        type: "installment",
        totalAmount: "12000000",
        monthlyAmount: "1000000",
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/debts?status=active`);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].name).toBe("Laptop");
    });
  });

  describe("PATCH /api/debt-accounts/:accountId/debts/:id", () => {
    it("should update a debt", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      const debt = await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      const { status, data } = await api.patch(
        `/api/debt-accounts/${accountId}/debts/${debt.data.data.id}`,
        { monthlyAmount: "2000000", description: "Increased payment" }
      );

      expect(status).toBe(200);
      expect(data.data.monthlyAmount).toBe("2000000.00");
      expect(data.data.description).toBe("Increased payment");
    });
  });

  describe("DELETE /api/debt-accounts/:accountId/debts/:id", () => {
    it("should cancel a debt", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      const debt = await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      const { status, data } = await api.delete(
        `/api/debt-accounts/${accountId}/debts/${debt.data.data.id}`
      );

      expect(status).toBe(200);
      expect(data.data.status).toBe("cancelled");
    });
  });

  // --- Payments ---

  describe("GET /api/debt-accounts/:accountId/payments", () => {
    it("should return empty payments initially", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });

      const { status, data } = await api.get(`/api/debt-accounts/${acc.data.data.id}/payments`);
      expect(status).toBe(200);
      expect(data.data).toHaveLength(0);
    });

    it("should return 404 for non-existent account", async () => {
      const { status } = await api.get(
        "/api/debt-accounts/00000000-0000-0000-0000-000000000000/payments"
      );
      expect(status).toBe(404);
    });
  });

  // --- Auto-Payment Detection ---

  describe("Auto-payment detection", () => {
    it("should auto-create payment when transaction category matches debt account", async () => {
      // Setup: category -> debt account -> debt
      const cat = await api.post("/api/categories", { name: "BRI CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
        autoTrack: true,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      // Create expense transaction with matching category
      await api.post("/api/transactions", {
        type: "expense",
        amount: "1500000",
        description: "BRI CC payment",
        categoryId,
      });

      // Verify payment was auto-created
      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].totalAmount).toBe("1500000.00");
      expect(data.data[0].transactionId).toBeDefined();
      expect(data.data[0].allocations).toHaveLength(1);
      expect(data.data[0].allocations[0].amount).toBe("1500000.00");
    });

    it("should not auto-create payment for income transactions", async () => {
      const cat = await api.post("/api/categories", { name: "BRI CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
        autoTrack: true,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      // Create income transaction (should not trigger auto-payment)
      await api.post("/api/transactions", {
        type: "income",
        amount: "1500000",
        categoryId,
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(0);
    });

    it("should allocate excess to first debt", async () => {
      const cat = await api.post("/api/categories", { name: "CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt A",
        type: "installment",
        totalAmount: "10000000",
        monthlyAmount: "1000000",
      });
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt B",
        type: "installment",
        totalAmount: "5000000",
        monthlyAmount: "500000",
      });

      // Pay more than total monthly (1M + 500K = 1.5M, paying 2M)
      await api.post("/api/transactions", {
        type: "expense",
        amount: "2000000",
        categoryId,
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(1);
      const allocations = data.data[0].allocations;
      expect(allocations).toHaveLength(2);

      // First debt: 1M monthly + 500K excess = 1.5M
      const debtAAlloc = allocations.find((a: any) => a.amount === "1500000.00");
      expect(debtAAlloc).toBeDefined();

      // Second debt: 500K monthly
      const debtBAlloc = allocations.find((a: any) => a.amount === "500000.00");
      expect(debtBAlloc).toBeDefined();
    });

    it("should skip auto-payment when autoTrack is false", async () => {
      const cat = await api.post("/api/categories", { name: "CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
        autoTrack: false,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt",
        type: "installment",
        totalAmount: "10000000",
        monthlyAmount: "1000000",
      });

      await api.post("/api/transactions", {
        type: "expense",
        amount: "1000000",
        categoryId,
      });

      const { data } = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(data.data).toHaveLength(0);
    });

    it("should remove payment when transaction is deleted", async () => {
      const cat = await api.post("/api/categories", { name: "CC Bills" });
      const categoryId = cat.data.data.id;

      const acc = await api.post("/api/debt-accounts", {
        name: "CC",
        type: "credit_card",
        billingDay: 20,
        categoryId,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Debt",
        type: "installment",
        totalAmount: "10000000",
        monthlyAmount: "1000000",
      });

      const tx = await api.post("/api/transactions", {
        type: "expense",
        amount: "1000000",
        categoryId,
      });

      // Verify payment exists
      let payments = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(payments.data.data).toHaveLength(1);

      // Delete the transaction
      await api.delete(`/api/transactions/${tx.data.data.id}`);

      // Payment should be gone
      payments = await api.get(`/api/debt-accounts/${accountId}/payments`);
      expect(payments.data.data).toHaveLength(0);
    });
  });

  // --- Summary ---

  describe("GET /api/debts/summary", () => {
    it("should return debt summary", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });

      const { status, data } = await api.get("/api/debts/summary");
      expect(status).toBe(200);
      expect(data.data.totalDebt).toBe("18000000.00");
      expect(data.data.totalPaid).toBe("0.00");
      expect(data.data.totalRemaining).toBe("18000000.00");
      expect(data.data.monthlyCommitment).toBe("1500000.00");
      expect(data.data.activeAccounts).toBe(1);
      expect(data.data.activeDebts).toBe(1);
      expect(data.data.byAccount).toHaveLength(1);
      expect(data.data.byType).toBeDefined();
      expect(data.data.byType.credit_card).toBeDefined();
    });

    it("should return empty summary when no debts", async () => {
      const { status, data } = await api.get("/api/debts/summary");
      expect(status).toBe(200);
      expect(data.data.totalDebt).toBe("0.00");
      expect(data.data.activeAccounts).toBe(0);
      expect(data.data.activeDebts).toBe(0);
    });
  });

  // --- Check Billing ---

  describe("POST /api/debts/check-billing", () => {
    it("should create transactions for accounts due on the given date", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
        autoTrack: true,
      });
      const accountId = acc.data.data.id;

      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "iPhone",
        type: "installment",
        totalAmount: "18000000",
        monthlyAmount: "1500000",
      });
      await api.post(`/api/debt-accounts/${accountId}/debts`, {
        name: "Laptop",
        type: "installment",
        totalAmount: "12000000",
        monthlyAmount: "1000000",
      });

      const { status, data } = await api.post("/api/debts/check-billing", {
        date: "2026-03-20T00:00:00Z",
      });

      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].accountName).toBe("BRI CC");
      expect(data.data[0].amount).toBe("2500000.00"); // 1.5M + 1M
    });

    it("should not create transactions for non-matching billing day", async () => {
      await api.post("/api/debt-accounts", {
        name: "BRI CC",
        type: "credit_card",
        billingDay: 20,
        autoTrack: true,
      });

      const { data } = await api.post("/api/debts/check-billing", {
        date: "2026-03-15T00:00:00Z",
      });

      expect(data.data).toHaveLength(0);
    });

    it("should skip accounts with autoTrack disabled", async () => {
      const acc = await api.post("/api/debt-accounts", {
        name: "Manual CC",
        type: "credit_card",
        billingDay: 20,
        autoTrack: false,
      });

      await api.post(`/api/debt-accounts/${acc.data.data.id}/debts`, {
        name: "Debt",
        type: "installment",
        totalAmount: "10000000",
        monthlyAmount: "1000000",
      });

      const { data } = await api.post("/api/debts/check-billing", {
        date: "2026-03-20T00:00:00Z",
      });

      expect(data.data).toHaveLength(0);
    });

    it("should reject invalid date", async () => {
      const { status } = await api.post("/api/debts/check-billing", {
        date: "invalid",
      });
      expect(status).toBe(400);
    });
  });
});
