import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables, getTestDb } from "./setup";
import { createApi, createTestUser, createTestUserDirect } from "./helpers";
import { categories } from "../src/db/schema";

describe("Transactions API", () => {
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
    // Create a test user and get authenticated API
    const { token, response } = await createTestUser();
    userId = response.data?.data?.user?.id;
    api = createApi(token);
  });

  describe("POST /api/transactions", () => {
    it("should create an expense transaction", async () => {
      const { status, data } = await api.post("/api/transactions", {
        type: "expense",
        amount: "25.50",
        description: "Coffee and snacks",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        type: "expense",
        amount: "25.50",
        description: "Coffee and snacks",
        userId,
      });
      expect(data.data.id).toBeDefined();
    });

    it("should create an income transaction", async () => {
      const { status, data } = await api.post("/api/transactions", {
        type: "income",
        amount: "3000.00",
        description: "Monthly salary",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        type: "income",
        amount: "3000.00",
        description: "Monthly salary",
      });
    });

    it("should create a positive adjustment transaction", async () => {
      const { status, data } = await api.post("/api/transactions", {
        type: "adjustment",
        amount: "500.00",
        description: "Starting balance",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        type: "adjustment",
        amount: "500.00",
        description: "Starting balance",
      });
    });

    it("should create a negative adjustment transaction", async () => {
      const { status, data } = await api.post("/api/transactions", {
        type: "adjustment",
        amount: "-100.00",
        description: "Balance correction",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        type: "adjustment",
        amount: "-100.00",
        description: "Balance correction",
      });
    });

    it("should create transaction with category", async () => {
      // First create a category
      const catResult = await api.post("/api/categories", { name: "Food & Dining" });
      const categoryId = catResult.data.data.id;

      const { status, data } = await api.post("/api/transactions", {
        type: "expense",
        amount: "15.00",
        description: "Lunch",
        categoryId,
      });

      expect(status).toBe(201);
      expect(data.data.categoryId).toBe(categoryId);
    });

    it("should auto-categorize when rule matches and no category provided", async () => {
      // Create category and rule
      const cat = await api.post("/api/categories", { name: "Transport" });
      const categoryId = cat.data.data.id;

      await api.post("/api/rules", {
        name: "Grab Rule",
        categoryId,
        conditions: [{ field: "description", operator: "contains", value: "grab" }],
      });

      // Create transaction without category
      const { status, data } = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "GRAB TRANSPORT",
      });

      expect(status).toBe(201);
      expect(data.data.categoryId).toBe(categoryId);
      expect(data.data.appliedRuleId).toBeDefined();
    });

    it("should not auto-categorize when category is provided", async () => {
      // Create two categories
      const cat1 = await api.post("/api/categories", { name: "Transport" });
      const cat2 = await api.post("/api/categories", { name: "Food" });

      await api.post("/api/rules", {
        name: "Grab Rule",
        categoryId: cat1.data.data.id,
        conditions: [{ field: "description", operator: "contains", value: "grab" }],
      });

      // Create transaction WITH explicit category
      const { status, data } = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "GRAB TRANSPORT",
        categoryId: cat2.data.data.id,
      });

      expect(status).toBe(201);
      expect(data.data.categoryId).toBe(cat2.data.data.id);
      expect(data.data.appliedRuleId).toBeNull();
    });

    it("should not auto-categorize when no rule matches", async () => {
      const cat = await api.post("/api/categories", { name: "Transport" });

      await api.post("/api/rules", {
        name: "Grab Rule",
        categoryId: cat.data.data.id,
        conditions: [{ field: "description", operator: "contains", value: "grab" }],
      });

      const { status, data } = await api.post("/api/transactions", {
        type: "expense",
        amount: "25000",
        description: "Coffee shop",
      });

      expect(status).toBe(201);
      expect(data.data.categoryId).toBeNull();
      expect(data.data.appliedRuleId).toBeNull();
    });

    it("should increment matchCount when auto-categorizing", async () => {
      const cat = await api.post("/api/categories", { name: "Transport" });
      const rule = await api.post("/api/rules", {
        name: "Grab Rule",
        categoryId: cat.data.data.id,
        conditions: [{ field: "description", operator: "contains", value: "grab" }],
      });
      const ruleId = rule.data.data.id;

      // Create two matching transactions
      await api.post("/api/transactions", { type: "expense", amount: "50000", description: "Grab ride" });
      await api.post("/api/transactions", { type: "expense", amount: "30000", description: "Grab food" });

      const { data } = await api.get(`/api/rules/${ruleId}`);
      expect(data.data.matchCount).toBe(2);
    });

    it("should reject invalid transaction type", async () => {
      const { status, data } = await api.post("/api/transactions", {
        type: "invalid",
        amount: "10.00",
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should reject missing required fields", async () => {
      const { status, data } = await api.post("/api/transactions", {
        description: "No amount or type",
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should reject unauthenticated requests", async () => {
      const unauthApi = createApi(); // No token
      const { status, data } = await unauthApi.post("/api/transactions", {
        type: "expense",
        amount: "10.00",
      });

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Duplicate transaction protection", () => {
    it("should update category instead of inserting when same amount+type+description+date", async () => {
      // Create two categories
      const cat1 = await api.post("/api/categories", { name: "Food" });
      const cat2 = await api.post("/api/categories", { name: "Groceries" });
      const cat1Id = cat1.data.data.id;
      const cat2Id = cat2.data.data.id;

      const txDate = "2026-03-08T12:00:00.000Z";

      // First insert
      const first = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Belanja bulanan",
        categoryId: cat1Id,
        date: txDate,
      });
      expect(first.status).toBe(201);

      // Second insert — same amount, type, description, date but different category
      const second = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Belanja bulanan",
        categoryId: cat2Id,
        date: txDate,
      });

      // Should be 200 (updated), not 201 (created)
      expect(second.status).toBe(200);
      expect(second.data.data.id).toBe(first.data.data.id);
      expect(second.data.data.categoryId).toBe(cat2Id);

      // Should still only have 1 transaction
      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(1);
    });

    it("should insert new transaction when amount differs", async () => {
      const txDate = "2026-03-08T12:00:00.000Z";

      await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Coffee",
        date: txDate,
      });

      const second = await api.post("/api/transactions", {
        type: "expense",
        amount: "75000",
        description: "Coffee",
        date: txDate,
      });

      expect(second.status).toBe(201);

      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(2);
    });

    it("should insert new transaction when description differs", async () => {
      const txDate = "2026-03-08T12:00:00.000Z";

      await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Coffee",
        date: txDate,
      });

      const second = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Tea",
        date: txDate,
      });

      expect(second.status).toBe(201);

      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(2);
    });

    it("should insert new transaction when type differs", async () => {
      const txDate = "2026-03-08T12:00:00.000Z";

      await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Transfer",
        date: txDate,
      });

      const second = await api.post("/api/transactions", {
        type: "income",
        amount: "50000",
        description: "Transfer",
        date: txDate,
      });

      expect(second.status).toBe(201);

      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(2);
    });

    it("should insert new transaction when date is on a different day", async () => {
      await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Coffee",
        date: "2026-03-08T12:00:00.000Z",
      });

      const second = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Coffee",
        date: "2026-03-09T12:00:00.000Z",
      });

      expect(second.status).toBe(201);

      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(2);
    });

    it("should treat same-day different-time as distinct", async () => {
      await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Coffee",
        date: "2026-03-08T08:00:00.000Z",
      });

      const second = await api.post("/api/transactions", {
        type: "expense",
        amount: "50000",
        description: "Coffee",
        date: "2026-03-08T20:00:00.000Z",
      });

      expect(second.status).toBe(201);

      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(2);
    });

    it("should handle null descriptions as matching", async () => {
      await api.post("/api/transactions", {
        type: "expense",
        amount: "25.00",
        date: "2026-03-08T12:00:00.000Z",
      });

      const second = await api.post("/api/transactions", {
        type: "expense",
        amount: "25.00",
        date: "2026-03-08T12:00:00.000Z",
      });

      expect(second.status).toBe(200);

      const list = await api.get("/api/transactions");
      expect(list.data.data).toHaveLength(1);
    });
  });

  describe("GET /api/transactions", () => {
    it("should list all transactions for the user", async () => {
      // Create some transactions
      await api.post("/api/transactions", { type: "expense", amount: "10.00" });
      await api.post("/api/transactions", { type: "expense", amount: "20.00" });
      await api.post("/api/transactions", { type: "income", amount: "100.00" });

      const { status, data } = await api.get("/api/transactions");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(3);
    });

    it("should filter by type", async () => {
      await api.post("/api/transactions", { type: "expense", amount: "10.00" });
      await api.post("/api/transactions", { type: "expense", amount: "20.00" });
      await api.post("/api/transactions", { type: "income", amount: "100.00" });

      const { status, data } = await api.get("/api/transactions?type=expense");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data.every((t: any) => t.type === "expense")).toBe(true);
    });

    it("should filter by adjustment type", async () => {
      await api.post("/api/transactions", { type: "expense", amount: "10.00" });
      await api.post("/api/transactions", { type: "adjustment", amount: "500.00" });
      await api.post("/api/transactions", { type: "adjustment", amount: "-50.00" });

      const { status, data } = await api.get("/api/transactions?type=adjustment");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data.every((t: any) => t.type === "adjustment")).toBe(true);
    });

    it("should return empty array when no transactions", async () => {
      const { status, data } = await api.get("/api/transactions");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(0);
    });

    it("should not return transactions from other users", async () => {
      // Create transaction with current user
      await api.post("/api/transactions", { type: "expense", amount: "10.00" });

      // Create another user
      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      // Other user should not see first user's transactions
      const { status, data } = await otherApi.get("/api/transactions");
      expect(status).toBe(200);
      expect(data.data).toHaveLength(0);
    });

    // Pagination tests
    it("should return default limit of 100 when no limit specified", async () => {
      // Create 5 transactions
      for (let i = 0; i < 5; i++) {
        await api.post("/api/transactions", { type: "expense", amount: "10.00", description: `Tx ${i}` });
      }

      const { status, data } = await api.get("/api/transactions");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(5);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(100);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.total).toBe(5);
    });

    it("should respect custom limit parameter", async () => {
      // Create 10 transactions
      for (let i = 0; i < 10; i++) {
        await api.post("/api/transactions", { type: "expense", amount: "10.00", description: `Tx ${i}` });
      }

      const { status, data } = await api.get("/api/transactions?limit=5");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(5);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.total).toBe(10);
    });

    it("should cap limit at maximum of 500", async () => {
      // Request limit of 1000, should be capped to 500
      const { status, data } = await api.get("/api/transactions?limit=1000");

      expect(status).toBe(200);
      expect(data.pagination.limit).toBe(500);
    });

    it("should respect offset parameter", async () => {
      // Create 5 transactions
      for (let i = 0; i < 5; i++) {
        await api.post("/api/transactions", { type: "expense", amount: "10.00", description: `Tx ${i}` });
      }

      const { status, data } = await api.get("/api/transactions?limit=2&offset=2");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.offset).toBe(2);
      expect(data.pagination.total).toBe(5);
    });

    it("should handle offset beyond total count", async () => {
      await api.post("/api/transactions", { type: "expense", amount: "10.00" });

      const { status, data } = await api.get("/api/transactions?offset=100");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(0);
      expect(data.pagination.offset).toBe(100);
      expect(data.pagination.total).toBe(1);
    });

    it("should work with filters and pagination together", async () => {
      // Create mixed transactions
      await api.post("/api/transactions", { type: "expense", amount: "10.00", description: "Expense 1" });
      await api.post("/api/transactions", { type: "expense", amount: "20.00", description: "Expense 2" });
      await api.post("/api/transactions", { type: "income", amount: "100.00", description: "Income 1" });
      await api.post("/api/transactions", { type: "income", amount: "200.00", description: "Income 2" });

      const { status, data } = await api.get("/api/transactions?type=expense&limit=1&offset=1");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].type).toBe("expense");
      expect(data.pagination.total).toBe(2); // Only 2 expense transactions
    });
  });

  describe("GET /api/transactions/:id", () => {
    it("should get a single transaction", async () => {
      const created = await api.post("/api/transactions", {
        type: "expense",
        amount: "50.00",
        description: "Test transaction",
      });

      const { status, data } = await api.get(
        `/api/transactions/${created.data.data.id}`
      );

      expect(status).toBe(200);
      expect(data.data.id).toBe(created.data.data.id);
      expect(data.data.amount).toBe("50.00");
    });

    it("should return 404 for non-existent transaction", async () => {
      const { status, data } = await api.get(
        "/api/transactions/00000000-0000-0000-0000-000000000000"
      );

      expect(status).toBe(404);
      expect(data.error).toBe("Transaction not found");
    });

    it("should not return another user's transaction", async () => {
      // Create transaction with current user
      const created = await api.post("/api/transactions", {
        type: "expense",
        amount: "50.00",
      });

      // Create another user
      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      // Other user should not access first user's transaction
      const { status, data } = await otherApi.get(
        `/api/transactions/${created.data.data.id}`
      );
      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/transactions/:id", () => {
    it("should update a transaction", async () => {
      const created = await api.post("/api/transactions", {
        type: "expense",
        amount: "25.00",
        description: "Original description",
      });

      const { status, data } = await api.patch(
        `/api/transactions/${created.data.data.id}`,
        {
          amount: "30.00",
          description: "Updated description",
        }
      );

      expect(status).toBe(200);
      expect(data.data.amount).toBe("30.00");
      expect(data.data.description).toBe("Updated description");
    });

    it("should return 404 for non-existent transaction", async () => {
      const { status, data } = await api.patch(
        "/api/transactions/00000000-0000-0000-0000-000000000000",
        { amount: "50.00" }
      );

      expect(status).toBe(404);
      expect(data.error).toBe("Transaction not found");
    });
  });

  describe("DELETE /api/transactions/:id", () => {
    it("should delete a transaction", async () => {
      const created = await api.post("/api/transactions", {
        type: "expense",
        amount: "25.00",
      });

      const { status, data } = await api.delete(
        `/api/transactions/${created.data.data.id}`
      );

      expect(status).toBe(200);
      expect(data.data.id).toBe(created.data.data.id);

      // Verify it's deleted
      const getResult = await api.get(
        `/api/transactions/${created.data.data.id}`
      );
      expect(getResult.status).toBe(404);
    });

    it("should return 404 for non-existent transaction", async () => {
      const { status, data } = await api.delete(
        "/api/transactions/00000000-0000-0000-0000-000000000000"
      );

      expect(status).toBe(404);
      expect(data.error).toBe("Transaction not found");
    });
  });
});
