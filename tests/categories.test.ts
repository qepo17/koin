import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { createApi, createTestUser, createTestUserDirect } from "./helpers";

describe("Categories API", () => {
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

  describe("POST /api/categories", () => {
    it("should create a category with name only", async () => {
      const { status, data } = await api.post("/api/categories", {
        name: "Food & Dining",
      });

      expect(status).toBe(201);
      expect(data.data.name).toBe("Food & Dining");
      expect(data.data.id).toBeDefined();
      expect(data.data.userId).toBeDefined();
    });

    it("should create a category with name, description, and color", async () => {
      const { status, data } = await api.post("/api/categories", {
        name: "Transport",
        description: "Public transport and ride-hailing",
        color: "#3b82f6",
      });

      expect(status).toBe(201);
      expect(data.data.name).toBe("Transport");
      expect(data.data.description).toBe("Public transport and ride-hailing");
      expect(data.data.color).toBe("#3b82f6");
    });

    it("should reject missing name", async () => {
      const { status } = await api.post("/api/categories", {});
      expect(status).toBe(400);
    });

    it("should reject unauthenticated requests", async () => {
      const unauthApi = createApi();
      const { status } = await unauthApi.post("/api/categories", { name: "Test" });
      expect(status).toBe(401);
    });
  });

  describe("GET /api/categories", () => {
    it("should list all categories for the user", async () => {
      await api.post("/api/categories", { name: "Food" });
      await api.post("/api/categories", { name: "Transport" });
      await api.post("/api/categories", { name: "Entertainment" });

      const { status, data } = await api.get("/api/categories");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(3);
    });

    it("should return empty array when no categories", async () => {
      const { status, data } = await api.get("/api/categories");

      expect(status).toBe(200);
      expect(data.data).toHaveLength(0);
    });

    it("should not return categories from other users", async () => {
      await api.post("/api/categories", { name: "My Category" });

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      const { status, data } = await otherApi.get("/api/categories");
      expect(status).toBe(200);
      expect(data.data).toHaveLength(0);
    });
  });

  describe("GET /api/categories/:id", () => {
    it("should get a single category", async () => {
      const created = await api.post("/api/categories", { name: "Food" });
      const categoryId = created.data.data.id;

      const { status, data } = await api.get(`/api/categories/${categoryId}`);

      expect(status).toBe(200);
      expect(data.data.id).toBe(categoryId);
      expect(data.data.name).toBe("Food");
    });

    it("should return 404 for non-existent category", async () => {
      const { status, data } = await api.get(
        "/api/categories/00000000-0000-0000-0000-000000000000"
      );

      expect(status).toBe(404);
      expect(data.error).toBe("Category not found");
    });

    it("should not return another user's category", async () => {
      const created = await api.post("/api/categories", { name: "My Category" });

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      const { status } = await otherApi.get(`/api/categories/${created.data.data.id}`);
      expect(status).toBe(404);
    });
  });

  describe("PATCH /api/categories/:id", () => {
    it("should update category name", async () => {
      const created = await api.post("/api/categories", { name: "Food" });

      const { status, data } = await api.patch(
        `/api/categories/${created.data.data.id}`,
        { name: "Food & Dining" }
      );

      expect(status).toBe(200);
      expect(data.data.name).toBe("Food & Dining");
    });

    it("should update category color", async () => {
      const created = await api.post("/api/categories", { name: "Food" });

      const { status, data } = await api.patch(
        `/api/categories/${created.data.data.id}`,
        { color: "#ef4444" }
      );

      expect(status).toBe(200);
      expect(data.data.color).toBe("#ef4444");
    });

    it("should return 404 for non-existent category", async () => {
      const { status, data } = await api.patch(
        "/api/categories/00000000-0000-0000-0000-000000000000",
        { name: "Updated" }
      );

      expect(status).toBe(404);
      expect(data.error).toBe("Category not found");
    });

    it("should not update another user's category", async () => {
      const created = await api.post("/api/categories", { name: "My Category" });

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      const { status } = await otherApi.patch(
        `/api/categories/${created.data.data.id}`,
        { name: "Hacked" }
      );
      expect(status).toBe(404);
    });
  });

  describe("DELETE /api/categories/:id", () => {
    it("should delete a category", async () => {
      const created = await api.post("/api/categories", { name: "Food" });

      const { status, data } = await api.delete(
        `/api/categories/${created.data.data.id}`
      );

      expect(status).toBe(200);
      expect(data.data.id).toBe(created.data.data.id);

      // Verify it's deleted
      const getResult = await api.get(`/api/categories/${created.data.data.id}`);
      expect(getResult.status).toBe(404);
    });

    it("should return 404 for non-existent category", async () => {
      const { status, data } = await api.delete(
        "/api/categories/00000000-0000-0000-0000-000000000000"
      );

      expect(status).toBe(404);
      expect(data.error).toBe("Category not found");
    });

    it("should not delete another user's category", async () => {
      const created = await api.post("/api/categories", { name: "My Category" });

      const { token: otherToken } = await createTestUserDirect();
      const otherApi = createApi(otherToken);

      const { status } = await otherApi.delete(`/api/categories/${created.data.data.id}`);
      expect(status).toBe(404);

      // Original user should still see it
      const check = await api.get(`/api/categories/${created.data.data.id}`);
      expect(check.status).toBe(200);
    });

    it("should fail to delete a category with linked transactions (FK constraint)", async () => {
      // Create category and transaction linked to it
      const cat = await api.post("/api/categories", { name: "Food" });
      const categoryId = cat.data.data.id;

      await api.post("/api/transactions", {
        type: "expense",
        amount: "25.00",
        description: "Lunch",
        categoryId,
      });

      // Delete should fail due to FK constraint (no ON DELETE CASCADE)
      const { status } = await api.delete(`/api/categories/${categoryId}`);
      expect(status).toBe(500);
    });
  });
});
