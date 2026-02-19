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
  });
});
