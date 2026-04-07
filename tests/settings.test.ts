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
    test("returns user settings with privacyMode defaulting to false", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.get("/api/settings");

      expect(result.status).toBe(200);
      expect(result.data.data.privacyMode).toBe(false);
    });

    test("returns user settings with privacyMode defaulting to false", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.get("/api/settings");

      expect(result.status).toBe(200);
      expect(result.data.data.privacyMode).toBe(false);
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

    test("updates privacyMode setting", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", { privacyMode: true });

      expect(result.status).toBe(200);
      expect(result.data.data.privacyMode).toBe(true);
    });

    test("updates multiple settings including privacyMode", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings", {
        currency: "IDR",
        privacyMode: true,
        name: "Private User",
      });

      expect(result.status).toBe(200);
      expect(result.data.data.currency).toBe("IDR");
      expect(result.data.data.privacyMode).toBe(true);
      expect(result.data.data.name).toBe("Private User");
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

  describe("GET /api/settings/privacy", () => {
    test("returns privacy mode status defaulting to false", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.get("/api/settings/privacy");

      expect(result.status).toBe(200);
      expect(result.data.data.enabled).toBe(false);
    });

    test("requires authentication", async () => {
      const api = createApi();
      const result = await api.get("/api/settings/privacy");

      expect(result.status).toBe(401);
    });
  });

  describe("PATCH /api/settings/privacy", () => {
    test("toggles privacy mode on", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings/privacy", { enabled: true });

      expect(result.status).toBe(200);
      expect(result.data.data.enabled).toBe(true);
    });

    test("toggles privacy mode off", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      // First enable privacy mode
      await api.patch("/api/settings/privacy", { enabled: true });

      // Then disable it
      const result = await api.patch("/api/settings/privacy", { enabled: false });

      expect(result.status).toBe(200);
      expect(result.data.data.enabled).toBe(false);
    });

    test("rejects invalid request body", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      const result = await api.patch("/api/settings/privacy", { enabled: "yes" });

      expect(result.status).toBe(400);
    });

    test("requires authentication", async () => {
      const api = createApi();
      const result = await api.patch("/api/settings/privacy", { enabled: true });

      expect(result.status).toBe(401);
    });

    test("persists across requests", async () => {
      const { token } = await createTestUser();
      const api = createApi(token);

      // Enable privacy mode
      await api.patch("/api/settings/privacy", { enabled: true });

      // Verify via GET endpoint
      const result = await api.get("/api/settings/privacy");
      expect(result.data.data.enabled).toBe(true);

      // Verify via main settings endpoint
      const settingsResult = await api.get("/api/settings");
      expect(settingsResult.data.data.privacyMode).toBe(true);
    });
  });
});
