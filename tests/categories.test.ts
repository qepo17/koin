import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { createApi, createTestUser, createTestUserDirect, api } from "./helpers";

describe("Categories API", () => {
  let authApi: ReturnType<typeof createApi>;
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
    authApi = createApi(token);
  });

  // ── CREATE ──────────────────────────────────────────────

  describe("POST /api/categories", () => {
    it("should create a category with name only", async () => {
      const { status, data } = await authApi.post("/api/categories", {
        name: "Food",
      });

      expect(status).toBe(201);
      expect(data.data.name).toBe("Food");
      expect(data.data.id).toBeDefined();
      expect(data.data.userId).toBe(userId);
      expect(data.data.color).toBe("#6b7280"); // default
    });

    it("should create a category with all fields", async () => {
      const { status, data } = await authApi.post("/api/categories", {
        name: "Transport",
        description: "Bus, taxi, fuel",
        color: "#ff5733",
      });

      expect(status).toBe(201);
      expect(data.data).toMatchObject({
        name: "Transport",
        description: "Bus, taxi, fuel",
        color: "#ff5733",
      });
    });

    it("should reject missing name", async () => {
      const { status } = await authApi.post("/api/categories", {
        description: "no name",
      });
      expect(status).toBe(400);
    });

    it("should reject empty name", async () => {
      const { status } = await authApi.post("/api/categories", {
        name: "",
      });
      expect(status).toBe(400);
    });

    it("should reject invalid color format", async () => {
      const { status } = await authApi.post("/api/categories", {
        name: "Bad Color",
        color: "red",
      });
      expect(status).toBe(400);
    });

    it("should reject color without hash", async () => {
      const { status } = await authApi.post("/api/categories", {
        name: "Bad Color",
        color: "ff5733",
      });
      expect(status).toBe(400);
    });

    it("should require authentication", async () => {
      const { status } = await api.post("/api/categories", { name: "Test" });
      expect(status).toBe(401);
    });
  });

  // ── LIST ────────────────────────────────────────────────

  describe("GET /api/categories", () => {
    it("should return empty array when no categories", async () => {
      const { status, data } = await authApi.get("/api/categories");
      expect(status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it("should list user categories", async () => {
      await authApi.post("/api/categories", { name: "Food" });
      await authApi.post("/api/categories", { name: "Transport" });
      await authApi.post("/api/categories", { name: "Bills" });

      const { status, data } = await authApi.get("/api/categories");
      expect(status).toBe(200);
      expect(data.data).toHaveLength(3);

      const names = data.data.map((c: any) => c.name).sort();
      expect(names).toEqual(["Bills", "Food", "Transport"]);
    });

    it("should not list another user's categories", async () => {
      // Create categories as first user
      await authApi.post("/api/categories", { name: "User1 Category" });

      // Create second user
      const { token: token2 } = await createTestUserDirect();
      const api2 = createApi(token2);

      const { data } = await api2.get("/api/categories");
      expect(data.data).toHaveLength(0);
    });

    it("should require authentication", async () => {
      const { status } = await api.get("/api/categories");
      expect(status).toBe(401);
    });
  });

  // ── GET SINGLE ──────────────────────────────────────────

  describe("GET /api/categories/:id", () => {
    it("should get a single category", async () => {
      const created = await authApi.post("/api/categories", {
        name: "Food",
        description: "All food expenses",
        color: "#e74c3c",
      });
      const id = created.data.data.id;

      const { status, data } = await authApi.get(`/api/categories/${id}`);
      expect(status).toBe(200);
      expect(data.data).toMatchObject({
        id,
        name: "Food",
        description: "All food expenses",
        color: "#e74c3c",
      });
    });

    it("should return 404 for non-existent category", async () => {
      const { status } = await authApi.get(
        "/api/categories/00000000-0000-0000-0000-000000000000"
      );
      expect(status).toBe(404);
    });

    it("should not access another user's category", async () => {
      const created = await authApi.post("/api/categories", { name: "Private" });
      const id = created.data.data.id;

      const { token: token2 } = await createTestUserDirect();
      const api2 = createApi(token2);

      const { status } = await api2.get(`/api/categories/${id}`);
      expect(status).toBe(404);
    });
  });

  // ── UPDATE ──────────────────────────────────────────────

  describe("PATCH /api/categories/:id", () => {
    it("should update category name", async () => {
      const created = await authApi.post("/api/categories", { name: "Food" });
      const id = created.data.data.id;

      const { status, data } = await authApi.patch(`/api/categories/${id}`, {
        name: "Groceries",
      });

      expect(status).toBe(200);
      expect(data.data.name).toBe("Groceries");
    });

    it("should update category color", async () => {
      const created = await authApi.post("/api/categories", { name: "Food" });
      const id = created.data.data.id;

      const { status, data } = await authApi.patch(`/api/categories/${id}`, {
        color: "#2ecc71",
      });

      expect(status).toBe(200);
      expect(data.data.color).toBe("#2ecc71");
      expect(data.data.name).toBe("Food"); // unchanged
    });

    it("should update multiple fields", async () => {
      const created = await authApi.post("/api/categories", { name: "Food" });
      const id = created.data.data.id;

      const { status, data } = await authApi.patch(`/api/categories/${id}`, {
        name: "Dining Out",
        description: "Restaurants and cafes",
        color: "#3498db",
      });

      expect(status).toBe(200);
      expect(data.data).toMatchObject({
        name: "Dining Out",
        description: "Restaurants and cafes",
        color: "#3498db",
      });
    });

    it("should reject invalid color on update", async () => {
      const created = await authApi.post("/api/categories", { name: "Food" });
      const id = created.data.data.id;

      const { status } = await authApi.patch(`/api/categories/${id}`, {
        color: "not-a-color",
      });
      expect(status).toBe(400);
    });

    it("should return 404 for non-existent category", async () => {
      const { status } = await authApi.patch(
        "/api/categories/00000000-0000-0000-0000-000000000000",
        { name: "Ghost" }
      );
      expect(status).toBe(404);
    });

    it("should not update another user's category", async () => {
      const created = await authApi.post("/api/categories", { name: "Private" });
      const id = created.data.data.id;

      const { token: token2 } = await createTestUserDirect();
      const api2 = createApi(token2);

      const { status } = await api2.patch(`/api/categories/${id}`, {
        name: "Hacked",
      });
      expect(status).toBe(404);

      // Verify unchanged
      const { data } = await authApi.get(`/api/categories/${id}`);
      expect(data.data.name).toBe("Private");
    });
  });

  // ── DELETE ──────────────────────────────────────────────

  describe("DELETE /api/categories/:id", () => {
    it("should delete a category", async () => {
      const created = await authApi.post("/api/categories", { name: "ToDelete" });
      const id = created.data.data.id;

      const { status, data } = await authApi.delete(`/api/categories/${id}`);
      expect(status).toBe(200);
      expect(data.data.id).toBe(id);

      // Verify gone
      const { status: getStatus } = await authApi.get(`/api/categories/${id}`);
      expect(getStatus).toBe(404);
    });

    it("should return 404 for non-existent category", async () => {
      const { status } = await authApi.delete(
        "/api/categories/00000000-0000-0000-0000-000000000000"
      );
      expect(status).toBe(404);
    });

    it("should not delete another user's category", async () => {
      const created = await authApi.post("/api/categories", { name: "Mine" });
      const id = created.data.data.id;

      const { token: token2 } = await createTestUserDirect();
      const api2 = createApi(token2);

      const { status } = await api2.delete(`/api/categories/${id}`);
      expect(status).toBe(404);

      // Verify still exists for owner
      const { status: getStatus } = await authApi.get(`/api/categories/${id}`);
      expect(getStatus).toBe(200);
    });

    it("should require authentication", async () => {
      const created = await authApi.post("/api/categories", { name: "Test" });
      const id = created.data.data.id;

      const { status } = await api.delete(`/api/categories/${id}`);
      expect(status).toBe(401);
    });
  });
});
