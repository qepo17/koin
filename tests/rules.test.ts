import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { createApi, createTestUser, createTestUserDirect } from "./helpers";

describe("Rules CRUD API", () => {
  let api: ReturnType<typeof createApi>;
  let userId: string;
  let categoryId: string;
  let categoryId2: string;

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

    // Create test categories
    const cat1 = await api.post("/api/categories", { name: "Food & Drink" });
    categoryId = cat1.data.data.id;
    const cat2 = await api.post("/api/categories", { name: "Transport" });
    categoryId2 = cat2.data.data.id;
  });

  const validConditions = [
    { field: "description", operator: "contains", value: "coffee" },
  ];

  // After Zod parsing, defaults are applied
  const validConditionsParsed = [
    { field: "description", operator: "contains", value: "coffee", negate: false, caseSensitive: false },
  ];

  describe("POST /api/rules", () => {
    it("should create a rule", async () => {
      const { status, data } = await api.post("/api/rules", {
        name: "Coffee Rule",
        categoryId,
        conditions: validConditions,
        priority: 10,
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        name: "Coffee Rule",
        categoryId,
        priority: 10,
        enabled: true,
        matchCount: 0,
      });
      expect(data.data.id).toBeDefined();
      expect(data.data.conditions).toEqual(validConditionsParsed);
    });

    it("should create a rule with defaults", async () => {
      const { status, data } = await api.post("/api/rules", {
        name: "Simple Rule",
        categoryId,
        conditions: validConditions,
      });

      expect(status).toBe(201);
      expect(data.data.priority).toBe(0);
      expect(data.data.enabled).toBe(true);
    });

    it("should create a disabled rule", async () => {
      const { status, data } = await api.post("/api/rules", {
        name: "Disabled Rule",
        categoryId,
        conditions: validConditions,
        enabled: false,
      });

      expect(status).toBe(201);
      expect(data.data.enabled).toBe(false);
    });

    it("should reject missing name", async () => {
      const { status } = await api.post("/api/rules", {
        categoryId,
        conditions: validConditions,
      });
      expect(status).toBe(400);
    });

    it("should reject name over 255 chars", async () => {
      const { status } = await api.post("/api/rules", {
        name: "x".repeat(256),
        categoryId,
        conditions: validConditions,
      });
      expect(status).toBe(400);
    });

    it("should reject missing categoryId", async () => {
      const { status } = await api.post("/api/rules", {
        name: "No Category",
        conditions: validConditions,
      });
      expect(status).toBe(400);
    });

    it("should reject invalid categoryId", async () => {
      const { status } = await api.post("/api/rules", {
        name: "Bad Category",
        categoryId: "00000000-0000-0000-0000-000000000000",
        conditions: validConditions,
      });
      expect(status).toBe(404);
    });

    it("should reject empty conditions", async () => {
      const { status } = await api.post("/api/rules", {
        name: "No Conditions",
        categoryId,
        conditions: [],
      });
      expect(status).toBe(400);
    });

    it("should reject invalid condition shape", async () => {
      const { status } = await api.post("/api/rules", {
        name: "Bad Condition",
        categoryId,
        conditions: [{ field: "invalid", operator: "eq", value: 5 }],
      });
      expect(status).toBe(400);
    });

    it("should reject another user's category", async () => {
      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      const { status } = await otherApi.post("/api/rules", {
        name: "Steal Category",
        categoryId,
        conditions: validConditions,
      });
      expect(status).toBe(404);
    });

    it("should require authentication", async () => {
      const noAuthApi = createApi();
      const { status } = await noAuthApi.post("/api/rules", {
        name: "No Auth",
        categoryId,
        conditions: validConditions,
      });
      expect(status).toBe(401);
    });
  });

  describe("GET /api/rules", () => {
    it("should list rules sorted by priority DESC", async () => {
      await api.post("/api/rules", { name: "Low", categoryId, conditions: validConditions, priority: 1 });
      await api.post("/api/rules", { name: "High", categoryId, conditions: validConditions, priority: 100 });
      await api.post("/api/rules", { name: "Mid", categoryId, conditions: validConditions, priority: 50 });

      const { status, data } = await api.get("/api/rules");
      expect(status).toBe(200);
      expect(data.data).toHaveLength(3);
      expect(data.data[0].name).toBe("High");
      expect(data.data[1].name).toBe("Mid");
      expect(data.data[2].name).toBe("Low");
    });

    it("should return empty array when no rules", async () => {
      const { status, data } = await api.get("/api/rules");
      expect(status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it("should not return other users' rules", async () => {
      await api.post("/api/rules", { name: "My Rule", categoryId, conditions: validConditions });

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);
      const { data } = await otherApi.get("/api/rules");
      expect(data.data).toEqual([]);
    });
  });

  describe("GET /api/rules/:id", () => {
    it("should get a single rule", async () => {
      const created = await api.post("/api/rules", {
        name: "My Rule",
        categoryId,
        conditions: validConditions,
      });
      const ruleId = created.data.data.id;

      const { status, data } = await api.get(`/api/rules/${ruleId}`);
      expect(status).toBe(200);
      expect(data.data.name).toBe("My Rule");
    });

    it("should return 404 for non-existent rule", async () => {
      const { status } = await api.get("/api/rules/00000000-0000-0000-0000-000000000000");
      expect(status).toBe(404);
    });

    it("should not return another user's rule", async () => {
      const created = await api.post("/api/rules", {
        name: "My Rule",
        categoryId,
        conditions: validConditions,
      });
      const ruleId = created.data.data.id;

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);
      const { status } = await otherApi.get(`/api/rules/${ruleId}`);
      expect(status).toBe(404);
    });
  });

  describe("PUT /api/rules/:id", () => {
    let ruleId: string;

    beforeEach(async () => {
      const created = await api.post("/api/rules", {
        name: "Original Rule",
        categoryId,
        conditions: validConditions,
        priority: 5,
      });
      ruleId = created.data.data.id;
    });

    it("should update rule name", async () => {
      const { status, data } = await api.put(`/api/rules/${ruleId}`, {
        name: "Updated Rule",
      });
      expect(status).toBe(200);
      expect(data.data.name).toBe("Updated Rule");
      expect(data.data.priority).toBe(5); // unchanged
    });

    it("should update rule priority", async () => {
      const { status, data } = await api.put(`/api/rules/${ruleId}`, {
        priority: 99,
      });
      expect(status).toBe(200);
      expect(data.data.priority).toBe(99);
    });

    it("should update rule conditions", async () => {
      const newConditions = [
        { field: "amount", operator: "gt", value: 100 },
      ];
      const { status, data } = await api.put(`/api/rules/${ruleId}`, {
        conditions: newConditions,
      });
      expect(status).toBe(200);
      expect(data.data.conditions).toEqual(newConditions);
    });

    it("should update categoryId", async () => {
      const { status, data } = await api.put(`/api/rules/${ruleId}`, {
        categoryId: categoryId2,
      });
      expect(status).toBe(200);
      expect(data.data.categoryId).toBe(categoryId2);
    });

    it("should toggle enabled", async () => {
      const { status, data } = await api.put(`/api/rules/${ruleId}`, {
        enabled: false,
      });
      expect(status).toBe(200);
      expect(data.data.enabled).toBe(false);
    });

    it("should reject invalid categoryId", async () => {
      const { status } = await api.put(`/api/rules/${ruleId}`, {
        categoryId: "00000000-0000-0000-0000-000000000000",
      });
      expect(status).toBe(404);
    });

    it("should return 404 for non-existent rule", async () => {
      const { status } = await api.put("/api/rules/00000000-0000-0000-0000-000000000000", {
        name: "Ghost",
      });
      expect(status).toBe(404);
    });

    it("should not update another user's rule", async () => {
      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);
      const { status } = await otherApi.put(`/api/rules/${ruleId}`, {
        name: "Hacked",
      });
      expect(status).toBe(404);
    });

    it("should reject invalid conditions", async () => {
      const { status } = await api.put(`/api/rules/${ruleId}`, {
        conditions: [],
      });
      expect(status).toBe(400);
    });
  });

  describe("DELETE /api/rules/:id", () => {
    it("should delete a rule", async () => {
      const created = await api.post("/api/rules", {
        name: "Delete Me",
        categoryId,
        conditions: validConditions,
      });
      const ruleId = created.data.data.id;

      const { status, data } = await api.delete(`/api/rules/${ruleId}`);
      expect(status).toBe(200);
      expect(data.data.name).toBe("Delete Me");

      // Verify it's gone
      const { status: getStatus } = await api.get(`/api/rules/${ruleId}`);
      expect(getStatus).toBe(404);
    });

    it("should return 404 for non-existent rule", async () => {
      const { status } = await api.delete("/api/rules/00000000-0000-0000-0000-000000000000");
      expect(status).toBe(404);
    });

    it("should not delete another user's rule", async () => {
      const created = await api.post("/api/rules", {
        name: "Protected",
        categoryId,
        conditions: validConditions,
      });
      const ruleId = created.data.data.id;

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);
      const { status } = await otherApi.delete(`/api/rules/${ruleId}`);
      expect(status).toBe(404);

      // Verify it still exists for original user
      const { status: getStatus } = await api.get(`/api/rules/${ruleId}`);
      expect(getStatus).toBe(200);
    });
  });
});
