import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";
import { eq } from "drizzle-orm";
import { setupTestDb, teardownTestDb, cleanupTables, getTestDb } from "./setup";
import { createTestApi, createTestUser, createTestUserDirect } from "./helpers";
import { categories, transactions, aiCommands } from "../src/db/schema";
import { resetRateLimits } from "../src/routes/ai";
import type { OpenRouterResponse } from "../src/types/ai";

describe("AI Command Endpoint", () => {
  let api: ReturnType<typeof createTestApi>;
  let token: string;
  let originalFetch: typeof globalThis.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  // Valid UUIDs for test data
  const CAT_FOOD_ID = "11111111-1111-1111-1111-111111111111";
  const CAT_TRANSPORT_ID = "22222222-2222-2222-2222-222222222222";
  const TX_1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const TX_2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const TX_3_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  beforeAll(async () => {
    await setupTestDb();
    originalFetch = globalThis.fetch;
    originalEnv = { ...process.env };
    // Set test API key for OpenRouter
    process.env.OPENROUTER_API_KEY = "test-key-for-mocking";
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
    resetRateLimits(); // Reset rate limits between tests
    api = createTestApi();

    // Create test user
    const result = await createTestUser();
    token = result.token;
    api.setToken(token);

    // Decode token to get userId
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    const userId = payload.sub;

    // Create test categories
    const db = getTestDb();
    await db.insert(categories).values([
      { id: CAT_FOOD_ID, userId, name: "Food", description: "Food and dining" },
      { id: CAT_TRANSPORT_ID, userId, name: "Transport", description: "Transportation" },
    ]);

    // Create test transactions
    await db.insert(transactions).values([
      { id: TX_1_ID, userId, type: "expense", amount: "5.50", description: "Coffee at Starbucks", date: new Date() },
      { id: TX_2_ID, userId, type: "expense", amount: "12.00", description: "Coffee and pastry", date: new Date() },
      { id: TX_3_ID, userId, type: "expense", amount: "50.00", description: "Groceries", date: new Date() },
    ]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Helper to mock OpenRouter response
  function mockOpenRouter(interpretation: string, filters: object, changes: object) {
    const mockResponse: OpenRouterResponse = {
      id: "test-id",
      model: "anthropic/claude-sonnet-4",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify({
            interpretation,
            action: {
              type: "update_transactions",
              filters,
              changes,
            },
          }),
        },
        finish_reason: "stop",
      }],
    };

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
    );
  }

  describe("POST /api/ai/command", () => {
    it("should require authentication", async () => {
      api.clearToken();
      const { status } = await api.post("/api/ai/command", { prompt: "test" });
      expect(status).toBe(401);
    });

    it("should require a prompt", async () => {
      const { status, data } = await api.post("/api/ai/command", {});
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should reject empty prompt", async () => {
      const { status, data } = await api.post("/api/ai/command", { prompt: "" });
      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should interpret prompt and return preview per #30 spec", async () => {
      mockOpenRouter(
        "I'll categorize coffee transactions as Food",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { status, data } = await api.post("/api/ai/command", {
        prompt: "Put all coffee expenses in Food category",
      });

      expect(status).toBe(201);
      // #30 spec: commandId instead of id
      expect(data.data.commandId).toBeDefined();
      expect(data.data.interpretation).toBe("I'll categorize coffee transactions as Food");
      // #30 spec: preview.matchCount instead of affectedCount
      expect(data.data.preview.matchCount).toBe(2);
      // #30 spec: preview.records instead of flat preview
      expect(data.data.preview.records).toHaveLength(2);
      // #30 spec: expiresIn (seconds) instead of expiresAt
      expect(data.data.expiresIn).toBe(300);

      // Check preview record structure per #30
      const record = data.data.preview.records[0];
      expect(record.id).toBeDefined();
      expect(record.before).toBeDefined();
      expect(record.after).toBeDefined();
      expect(record.after.category).toBe("Food");
    });

    it("should return 404 when no transactions match", async () => {
      mockOpenRouter(
        "I'll update taxi transactions",
        { description_contains: "taxi" },
        { categoryId: CAT_TRANSPORT_ID }
      );

      const { status, data } = await api.post("/api/ai/command", {
        prompt: "Put all taxi rides in Transport",
      });

      expect(status).toBe(404);
      expect(data.error).toContain("No transactions match");
      expect(data.interpretation).toBeDefined();
    });

    it("should reject invalid category in changes", async () => {
      mockOpenRouter(
        "I'll categorize",
        { description_contains: "coffee" },
        { categoryId: "99999999-9999-9999-9999-999999999999" }
      );

      const { status, data } = await api.post("/api/ai/command", {
        prompt: "Put coffee in NonExistent",
      });

      expect(status).toBe(400);
      expect(data.error).toContain("category not found");
    });

    it("should store command in database", async () => {
      mockOpenRouter(
        "Test interpretation",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Test prompt",
      });

      const db = getTestDb();
      const [command] = await db
        .select()
        .from(aiCommands)
        .where(eq(aiCommands.id, data.data.commandId));

      expect(command).toBeDefined();
      expect(command.status).toBe("pending");
      expect(command.prompt).toBe("Test prompt");
      expect(command.interpretation).toBe("Test interpretation");
    });

    it("should enforce rate limit of 10 requests per minute", async () => {
      mockOpenRouter("Test", { description_contains: "coffee" }, { categoryId: CAT_FOOD_ID });

      // Make 10 requests (should all succeed)
      for (let i = 0; i < 10; i++) {
        const { status } = await api.post("/api/ai/command", { prompt: "Test" });
        expect(status).toBe(201);
      }

      // 11th request should be rate limited
      const { status, data, response } = await api.post("/api/ai/command", { prompt: "Test" });
      expect(status).toBe(429);
      expect(data.error).toContain("Rate limit");
      expect(data.retryAfter).toBeDefined();
    });
  });

  describe("GET /api/ai/command/:id", () => {
    it("should return command status per #32 spec", async () => {
      mockOpenRouter(
        "Test interpretation",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test prompt",
      });

      const { status, data } = await api.get(`/api/ai/command/${createData.data.commandId}`);

      expect(status).toBe(200);
      // #32 spec uses "id" instead of "commandId"
      expect(data.data.id).toBe(createData.data.commandId);
      expect(data.data.status).toBe("pending");
      expect(data.data.prompt).toBe("Test prompt");
      expect(data.data.interpretation).toBe("Test interpretation");
      expect(data.data.preview.matchCount).toBe(2);
      expect(data.data.preview.records).toHaveLength(2);
      // #32 spec uses expiresAt timestamp instead of expiresIn
      expect(data.data.expiresAt).toBeDefined();
      expect(data.data.createdAt).toBeDefined();
    });

    it("should return 404 for non-existent command", async () => {
      const { status } = await api.get("/api/ai/command/00000000-0000-0000-0000-000000000000");
      expect(status).toBe(404);
    });

    it("should not return another user's command", async () => {
      mockOpenRouter(
        "Test interpretation",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test prompt",
      });

      // Create another user and try to access
      const user2 = await createTestUserDirect({ email: "user2@example.com" });
      api.setToken(user2.token);

      const { status } = await api.get(`/api/ai/command/${createData.data.commandId}`);
      expect(status).toBe(404);
    });

    it("should auto-expire stale pending commands", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      // Manually expire the command in DB
      const db = getTestDb();
      await db
        .update(aiCommands)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(aiCommands.id, createData.data.commandId));

      // GET should return expired status and update DB
      const { status, data } = await api.get(`/api/ai/command/${createData.data.commandId}`);
      expect(status).toBe(200);
      expect(data.data.status).toBe("expired");

      // Verify DB was updated
      const [command] = await db
        .select()
        .from(aiCommands)
        .where(eq(aiCommands.id, createData.data.commandId));
      expect(command.status).toBe("expired");
    });
  });

  describe("GET /api/ai/commands", () => {
    it("should require authentication", async () => {
      api.clearToken();
      const { status } = await api.get("/api/ai/commands");
      expect(status).toBe(401);
    });

    it("should list user commands with pagination", async () => {
      mockOpenRouter("Test 1", { description_contains: "coffee" }, { categoryId: CAT_FOOD_ID });

      // Create 3 commands
      await api.post("/api/ai/command", { prompt: "Test 1" });
      await api.post("/api/ai/command", { prompt: "Test 2" });
      await api.post("/api/ai/command", { prompt: "Test 3" });

      const { status, data } = await api.get("/api/ai/commands");

      expect(status).toBe(200);
      expect(data.data.commands).toHaveLength(3);
      expect(data.data.total).toBe(3);
      expect(data.data.limit).toBe(20);
      expect(data.data.offset).toBe(0);

      // Should be ordered by createdAt DESC
      expect(data.data.commands[0].prompt).toBe("Test 3");
    });

    it("should filter by status", async () => {
      mockOpenRouter("Test", { description_contains: "coffee" }, { categoryId: CAT_FOOD_ID });

      // Create and confirm one command
      const { data: createData } = await api.post("/api/ai/command", { prompt: "To confirm" });
      await api.post(`/api/ai/command/${createData.data.commandId}/confirm`, {});

      // Create another pending command
      await api.post("/api/ai/command", { prompt: "Pending" });

      // Filter by confirmed
      const { data: confirmedData } = await api.get("/api/ai/commands?status=confirmed");
      expect(confirmedData.data.commands).toHaveLength(1);
      expect(confirmedData.data.commands[0].status).toBe("confirmed");

      // Filter by pending
      const { data: pendingData } = await api.get("/api/ai/commands?status=pending");
      expect(pendingData.data.commands).toHaveLength(1);
      expect(pendingData.data.commands[0].status).toBe("pending");
    });

    it("should respect limit and offset", async () => {
      mockOpenRouter("Test", { description_contains: "coffee" }, { categoryId: CAT_FOOD_ID });

      // Create 5 commands
      for (let i = 1; i <= 5; i++) {
        await api.post("/api/ai/command", { prompt: `Test ${i}` });
      }

      // Get first 2
      const { data: page1 } = await api.get("/api/ai/commands?limit=2&offset=0");
      expect(page1.data.commands).toHaveLength(2);
      expect(page1.data.commands[0].prompt).toBe("Test 5");
      expect(page1.data.commands[1].prompt).toBe("Test 4");

      // Get next 2
      const { data: page2 } = await api.get("/api/ai/commands?limit=2&offset=2");
      expect(page2.data.commands).toHaveLength(2);
      expect(page2.data.commands[0].prompt).toBe("Test 3");
    });

    it("should not return other users commands", async () => {
      mockOpenRouter("Test", { description_contains: "coffee" }, { categoryId: CAT_FOOD_ID });

      // Create command as user 1
      await api.post("/api/ai/command", { prompt: "User 1 command" });

      // Switch to user 2
      const user2 = await createTestUserDirect({ email: "user2@example.com" });
      api.setToken(user2.token);

      // Should see empty list
      const { status, data } = await api.get("/api/ai/commands");
      expect(status).toBe(200);
      expect(data.data.commands).toHaveLength(0);
      expect(data.data.total).toBe(0);
    });

    it("should cap limit at 100", async () => {
      const { data } = await api.get("/api/ai/commands?limit=500");
      expect(data.data.limit).toBe(100);
    });
  });

  describe("POST /api/ai/command/:id/confirm", () => {
    it("should execute pending command", async () => {
      mockOpenRouter(
        "Categorizing coffee as Food",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Put coffee in Food",
      });

      const { status, data } = await api.post(`/api/ai/command/${createData.data.commandId}/confirm`, {});

      expect(status).toBe(200);
      expect(data.data.commandId).toBe(createData.data.commandId);
      expect(data.data.status).toBe("confirmed");
      expect(data.data.result.updatedCount).toBe(2);
      expect(data.data.result.transactions).toHaveLength(2);
      expect(data.data.result.transactions[0]).toHaveProperty("id");
      expect(data.data.result.transactions[0]).toHaveProperty("description");
      expect(data.data.result.transactions[0]).toHaveProperty("category");

      // Verify transactions were updated
      const db = getTestDb();
      const txs = await db.select().from(transactions);
      const coffeeTxs = txs.filter(tx => tx.description?.includes("coffee"));

      for (const tx of coffeeTxs) {
        expect(tx.categoryId).toBe(CAT_FOOD_ID);
      }
    });

    it("should return 404 for non-existent command", async () => {
      const { status } = await api.post("/api/ai/command/00000000-0000-0000-0000-000000000000/confirm", {});
      expect(status).toBe(404);
    });

    it("should reject already confirmed command", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      // Confirm once
      await api.post(`/api/ai/command/${createData.data.commandId}/confirm`, {});

      // Try to confirm again
      const { status, data } = await api.post(`/api/ai/command/${createData.data.commandId}/confirm`, {});
      expect(status).toBe(400);
      expect(data.error).toContain("already confirmed");
    });

    it("should reject expired command", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      // Manually expire the command
      const db = getTestDb();
      await db
        .update(aiCommands)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(aiCommands.id, createData.data.commandId));

      const { status, data } = await api.post(`/api/ai/command/${createData.data.commandId}/confirm`, {});
      expect(status).toBe(400);
      expect(data.error).toContain("expired");
    });

    it("should update command status to confirmed", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      await api.post(`/api/ai/command/${createData.data.commandId}/confirm`, {});

      const db = getTestDb();
      const [command] = await db
        .select()
        .from(aiCommands)
        .where(eq(aiCommands.id, createData.data.commandId));

      expect(command.status).toBe("confirmed");
      expect(command.executedAt).toBeDefined();
      expect(command.result).toBeDefined();

      const result = JSON.parse(command.result!);
      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(2);
    });
  });

  describe("POST /api/ai/command/:id/cancel", () => {
    it("should cancel pending command", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      const { status, data } = await api.post(`/api/ai/command/${createData.data.commandId}/cancel`, {});

      expect(status).toBe(200);
      expect(data.data.commandId).toBe(createData.data.commandId);
      expect(data.data.status).toBe("cancelled");
      expect(data.data.message).toContain("cancelled");
    });

    it("should return 404 for non-existent command", async () => {
      const { status } = await api.post("/api/ai/command/00000000-0000-0000-0000-000000000000/cancel", {});
      expect(status).toBe(404);
    });

    it("should reject already cancelled command", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      // Cancel once
      await api.post(`/api/ai/command/${createData.data.commandId}/cancel`, {});

      // Try to cancel again
      const { status, data } = await api.post(`/api/ai/command/${createData.data.commandId}/cancel`, {});
      expect(status).toBe(400);
      expect(data.error).toContain("already cancelled");
    });

    it("should not affect transactions when cancelled", async () => {
      mockOpenRouter(
        "Test",
        { description_contains: "coffee" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data: createData } = await api.post("/api/ai/command", {
        prompt: "Test",
      });

      // Get transactions before cancel
      const db = getTestDb();
      const txsBefore = await db.select().from(transactions);

      await api.post(`/api/ai/command/${createData.data.commandId}/cancel`, {});

      // Verify transactions unchanged
      const txsAfter = await db.select().from(transactions);
      expect(txsAfter).toEqual(txsBefore);
    });
  });

  describe("Filter types", () => {
    it("should filter by amount_equals", async () => {
      mockOpenRouter(
        "Updating $5.50 transactions",
        { amount_equals: 5.5 },
        { categoryId: CAT_FOOD_ID }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Update transactions of exactly $5.50",
      });

      expect(data.data.preview.matchCount).toBe(1);
      expect(data.data.preview.records[0].before.amount).toBe("5.50");
    });

    it("should filter by transaction_type", async () => {
      mockOpenRouter(
        "Updating expenses",
        { transaction_type: "expense" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Categorize all expenses",
      });

      expect(data.data.preview.matchCount).toBe(3); // All 3 are expenses
    });

    it("should filter by amount_range", async () => {
      mockOpenRouter(
        "Updating transactions between $10-$20",
        { amount_range: { min: 10, max: 20 } },
        { categoryId: CAT_FOOD_ID }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Update transactions between $10 and $20",
      });

      expect(data.data.preview.matchCount).toBe(1); // Only TX_2 ($12.00)
    });

    it("should filter by category_name", async () => {
      // First, assign a category to TX_1
      const db = getTestDb();
      await db
        .update(transactions)
        .set({ categoryId: CAT_FOOD_ID })
        .where(eq(transactions.id, TX_1_ID));

      mockOpenRouter(
        "Moving Food transactions to Transport",
        { category_name: "Food" },
        { categoryId: CAT_TRANSPORT_ID }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Move Food transactions to Transport",
      });

      expect(data.data.preview.matchCount).toBe(1);
      expect(data.data.preview.records[0].before.category).toBe("Food");
      expect(data.data.preview.records[0].after.category).toBe("Transport");
    });
  });

  describe("Change types", () => {
    it("should change amount", async () => {
      mockOpenRouter(
        "Updating amount",
        { description_contains: "coffee" },
        { amount: "10.00" }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Change coffee to $10",
      });

      expect(data.data.preview.records[0].after.amount).toBe("10.00");
    });

    it("should change description", async () => {
      mockOpenRouter(
        "Updating description",
        { description_contains: "coffee" },
        { description: "Morning coffee" }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Rename coffee to Morning coffee",
      });

      expect(data.data.preview.records[0].after.description).toBe("Morning coffee");
    });

    it("should change category", async () => {
      mockOpenRouter(
        "Categorizing as Food",
        { description_contains: "Groceries" },
        { categoryId: CAT_FOOD_ID }
      );

      const { data } = await api.post("/api/ai/command", {
        prompt: "Put Groceries in Food",
      });

      expect(data.data.preview.records[0].before.category).toBeNull();
      expect(data.data.preview.records[0].after.category).toBe("Food");
    });
  });
});
