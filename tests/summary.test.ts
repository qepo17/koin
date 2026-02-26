import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { createApi, createTestUser } from "./helpers";

describe("Summary API", () => {
  let api: ReturnType<typeof createApi>;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
    const { token } = await createTestUser();
    api = createApi(token);
  });

  describe("GET /api/summary", () => {
    it("should return empty summary with no transactions", async () => {
      const { status, data } = await api.get("/api/summary");

      expect(status).toBe(200);
      expect(data.data.income).toBe(0);
      expect(data.data.expenses).toBe(0);
      expect(data.data.adjustments).toBe(0);
      expect(data.data.balance).toBe(0);
    });

    it("should calculate balance correctly with income and expenses", async () => {
      await api.post("/api/transactions", { type: "income", amount: "1000.00" });
      await api.post("/api/transactions", { type: "expense", amount: "300.00" });
      await api.post("/api/transactions", { type: "expense", amount: "200.00" });

      const { status, data } = await api.get("/api/summary");

      expect(status).toBe(200);
      expect(data.data.income).toBe(1000);
      expect(data.data.expenses).toBe(500);
      expect(data.data.adjustments).toBe(0);
      expect(data.data.balance).toBe(500); // 1000 - 500 + 0
    });

    it("should include positive adjustments in balance", async () => {
      await api.post("/api/transactions", { type: "income", amount: "1000.00" });
      await api.post("/api/transactions", { type: "expense", amount: "500.00" });
      await api.post("/api/transactions", { type: "adjustment", amount: "200.00", description: "Starting balance" });

      const { status, data } = await api.get("/api/summary");

      expect(status).toBe(200);
      expect(data.data.income).toBe(1000);
      expect(data.data.expenses).toBe(500);
      expect(data.data.adjustments).toBe(200);
      expect(data.data.balance).toBe(700); // 1000 - 500 + 200
    });

    it("should include negative adjustments in balance", async () => {
      await api.post("/api/transactions", { type: "income", amount: "1000.00" });
      await api.post("/api/transactions", { type: "expense", amount: "300.00" });
      await api.post("/api/transactions", { type: "adjustment", amount: "-150.00", description: "Correction" });

      const { status, data } = await api.get("/api/summary");

      expect(status).toBe(200);
      expect(data.data.income).toBe(1000);
      expect(data.data.expenses).toBe(300);
      expect(data.data.adjustments).toBe(-150);
      expect(data.data.balance).toBe(550); // 1000 - 300 + (-150)
    });

    it("should not include adjustments in byCategory", async () => {
      // Create a category
      const catResult = await api.post("/api/categories", { name: "Food" });
      const categoryId = catResult.data.data.id;

      await api.post("/api/transactions", { type: "expense", amount: "100.00", categoryId });
      await api.post("/api/transactions", { type: "adjustment", amount: "500.00", categoryId });

      const { status, data } = await api.get("/api/summary");

      expect(status).toBe(200);
      // byCategory should only include expenses
      expect(data.data.byCategory).toHaveLength(1);
      expect(data.data.byCategory[0].total).toBe("100.00");
    });

    it("should require authentication", async () => {
      const unauthApi = createApi();
      const { status } = await unauthApi.get("/api/summary");

      expect(status).toBe(401);
    });

    it("should filter by from date", async () => {
      // Create transactions on different dates
      await api.post("/api/transactions", { 
        type: "income", 
        amount: "100.00", 
        date: "2026-01-15T10:00:00Z" 
      });
      await api.post("/api/transactions", { 
        type: "income", 
        amount: "200.00", 
        date: "2026-02-15T10:00:00Z" 
      });

      const { status, data } = await api.get("/api/summary?from=2026-02-01");

      expect(status).toBe(200);
      expect(data.data.income).toBe(200); // Only Feb transaction
    });

    it("should filter by to date", async () => {
      await api.post("/api/transactions", { 
        type: "expense", 
        amount: "100.00", 
        date: "2026-01-15T10:00:00Z" 
      });
      await api.post("/api/transactions", { 
        type: "expense", 
        amount: "200.00", 
        date: "2026-02-15T10:00:00Z" 
      });

      const { status, data } = await api.get("/api/summary?to=2026-01-31");

      expect(status).toBe(200);
      expect(data.data.expenses).toBe(100); // Only Jan transaction
    });

    it("should filter by date range (from and to)", async () => {
      await api.post("/api/transactions", { 
        type: "income", 
        amount: "100.00", 
        date: "2026-01-15T10:00:00Z" 
      });
      await api.post("/api/transactions", { 
        type: "income", 
        amount: "200.00", 
        date: "2026-02-15T10:00:00Z" 
      });
      await api.post("/api/transactions", { 
        type: "income", 
        amount: "300.00", 
        date: "2026-03-15T10:00:00Z" 
      });

      const { status, data } = await api.get("/api/summary?from=2026-02-01&to=2026-02-28");

      expect(status).toBe(200);
      expect(data.data.income).toBe(200); // Only Feb transaction
      expect(data.data.balance).toBe(200);
    });

    it("should include transactions on the to date boundary", async () => {
      await api.post("/api/transactions", { 
        type: "expense", 
        amount: "150.00", 
        date: "2026-01-31T23:30:00Z" 
      });

      const { status, data } = await api.get("/api/summary?to=2026-01-31");

      expect(status).toBe(200);
      expect(data.data.expenses).toBe(150); // Should include end-of-day transaction
    });

    it("should apply date filter to byCategory", async () => {
      const catResult = await api.post("/api/categories", { name: "Food" });
      const categoryId = catResult.data.data.id;

      await api.post("/api/transactions", { 
        type: "expense", 
        amount: "50.00", 
        categoryId,
        date: "2026-01-15T10:00:00Z" 
      });
      await api.post("/api/transactions", { 
        type: "expense", 
        amount: "75.00", 
        categoryId,
        date: "2026-02-15T10:00:00Z" 
      });

      const { status, data } = await api.get("/api/summary?from=2026-02-01");

      expect(status).toBe(200);
      expect(data.data.byCategory).toHaveLength(1);
      expect(data.data.byCategory[0].total).toBe("75.00"); // Only Feb expense
    });

    it("should ignore invalid date formats", async () => {
      await api.post("/api/transactions", { type: "income", amount: "500.00" });

      const { status, data } = await api.get("/api/summary?from=invalid-date");

      expect(status).toBe(200);
      expect(data.data.income).toBe(500); // Should return all data
    });
  });
});
