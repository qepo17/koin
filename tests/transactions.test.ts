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
