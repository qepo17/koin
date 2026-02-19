import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { createTestUser, createApi } from "./helpers";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";

describe("Settings API", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe("GET /api/settings", () => {
    test("returns user settings with default currency", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.get("/api/settings");

      expect(result.status).toBe(200);
      expect(result.data.data.currency).toBe("USD");
    });

    test("requires authentication", async () => {
      const api = createApi();
      const result = await api.get("/api/settings");

      expect(result.status).toBe(401);
    });
  });

  describe("PATCH /api/settings", () => {
    test("updates currency setting", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", { currency: "EUR" });

      expect(result.status).toBe(200);
      expect(result.data.data.currency).toBe("EUR");
    });

    test("updates name setting", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", { name: "New Name" });

      expect(result.status).toBe(200);
      expect(result.data.data.name).toBe("New Name");
    });

    test("updates multiple settings at once", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", {
        currency: "GBP",
        name: "Updated Name",
      });

      expect(result.status).toBe(200);
      expect(result.data.data.currency).toBe("GBP");
      expect(result.data.data.name).toBe("Updated Name");
    });

    test("validates currency is 3 characters", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", { currency: "EURO" });

      expect(result.status).toBe(400);
    });

    test("converts currency to uppercase", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", { currency: "eur" });

      expect(result.status).toBe(200);
      expect(result.data.data.currency).toBe("EUR");
    });

    test("rejects empty update", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", {});

      expect(result.status).toBe(400);
    });

    test("requires authentication", async () => {
      const api = createApi();
      const result = await api.patch("/api/settings", { currency: "EUR" });

      expect(result.status).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    test("includes currency in user response", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.get("/api/auth/me");

      expect(result.status).toBe(200);
      expect(result.data.data.currency).toBe("USD");
    });
  });

  describe("POST /api/auth/login", () => {
    test("includes currency in login response", async () => {
      const { user, token } = await createTestUser();
      const api = createApi();

      const result = await api.post("/api/auth/login", {
        email: user.email,
        password: user.password,
      });

      expect(result.status).toBe(200);
      expect(result.data.data.user.currency).toBe("USD");
    });
  });
});
