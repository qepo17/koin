import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, teardownTestDb } from "./setup";
import { createTestApi, generateTestUser, type TestApi } from "./helpers";
import { app } from "../src/index";

describe("Skill API", () => {
  let api: TestApi;

  beforeAll(async () => {
    await setupTestDb();
    api = createTestApi();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("GET /api/skill/download", () => {
    it("should return SKILL.md with API URL placeholder replaced", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const response = await app.fetch(
        new Request("http://localhost/api/skill/download", {
          headers: { Authorization: `Bearer ${api.getToken()}` },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/markdown");
      expect(response.headers.get("Content-Disposition")).toBe(
        "attachment; filename=SKILL.md"
      );

      const content = await response.text();
      expect(content).toContain("# Koin Finance API Skill");
      expect(content).toContain("KOIN_API_URL");
      expect(content).toContain("KOIN_API_TOKEN");
      expect(content).not.toContain("{{API_URL}}");
    });

    it("should return 401 without authentication", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/skill/download")
      );
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/skill/preview", () => {
    it("should return preview with base URL", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.get("/api/skill/preview");

      expect(status).toBe(200);
      expect(data.data).toHaveProperty("baseUrl");
      expect(data.data.baseUrl).toContain("/api");
    });

    it("should return 401 without authentication", async () => {
      const unauthApi = createTestApi();
      const { status } = await unauthApi.get("/api/skill/preview");
      expect(status).toBe(401);
    });
  });

  describe("POST /api/skill/tokens", () => {
    it("should create a new API token", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/skill/tokens", {
        name: "Test Agent",
        expiresIn: "never",
      });

      expect(status).toBe(201);
      expect(data.data).toHaveProperty("token");
      expect(data.data).toHaveProperty("id");
      expect(data.data).toHaveProperty("name", "Test Agent");
      expect(data.data).toHaveProperty("tokenPrefix");
      expect(data.data.token).toMatch(/^koin_/);
      expect(data.data.expiresAt).toBeNull();
    });

    it("should create token with expiration", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/skill/tokens", {
        name: "Expiring Token",
        expiresIn: "7d",
      });

      expect(status).toBe(201);
      expect(data.data.expiresAt).not.toBeNull();
      
      const expiresAt = new Date(data.data.expiresAt);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6);
      expect(diffDays).toBeLessThan(8);
    });

    it("should return 401 without authentication", async () => {
      const unauthApi = createTestApi();
      const { status } = await unauthApi.post("/api/skill/tokens", {
        name: "Test",
        expiresIn: "never",
      });
      expect(status).toBe(401);
    });
  });

  describe("GET /api/skill/tokens", () => {
    it("should list user tokens", async () => {
      // Use a fresh API instance for isolation
      const freshApi = createTestApi();
      const user = generateTestUser();
      await freshApi.post("/api/auth/register", user);
      
      // Create tokens
      await freshApi.post("/api/skill/tokens", { name: "Token 1", expiresIn: "never" });
      await freshApi.post("/api/skill/tokens", { name: "Token 2", expiresIn: "30d" });

      const { status, data } = await freshApi.get("/api/skill/tokens");

      expect(status).toBe(200);
      expect(data.data).toBeArray();
      expect(data.data).toHaveLength(2);
      expect(data.data[0]).toHaveProperty("name");
      expect(data.data[0]).toHaveProperty("tokenPrefix");
      expect(data.data[0]).not.toHaveProperty("token"); // Full token not returned in list
    });
  });

  describe("DELETE /api/skill/tokens/:id", () => {
    it("should revoke a token", async () => {
      const user = generateTestUser();
      const regResult = await api.post("/api/auth/register", user);
      const sessionToken = regResult.data?.data?.token;
      
      // Create an API token
      const createResult = await api.post("/api/skill/tokens", {
        name: "To Revoke",
        expiresIn: "never",
      });
      const tokenId = createResult.data.data.id;
      const apiToken = createResult.data.data.token;

      // Revoke it
      const { status } = await api.delete(`/api/skill/tokens/${tokenId}`);
      expect(status).toBe(200);

      // Verify the API token no longer works
      const response = await app.fetch(
        new Request("http://localhost/api/transactions", {
          headers: { Authorization: `Bearer ${apiToken}` },
        })
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 for non-existent token", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status } = await api.delete("/api/skill/tokens/00000000-0000-0000-0000-000000000000");
      expect(status).toBe(404);
    });
  });

  describe("API Token Authentication", () => {
    it("should authenticate with API token", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);
      
      // Create an API token
      const { data: tokenData } = await api.post("/api/skill/tokens", {
        name: "Auth Test",
        expiresIn: "never",
      });
      const apiToken = tokenData.data.token;

      // Use the API token to make a request
      const response = await app.fetch(
        new Request("http://localhost/api/transactions", {
          headers: { Authorization: `Bearer ${apiToken}` },
        })
      );

      expect(response.status).toBe(200);
    });

    it("should reject revoked API token", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);
      
      // Create and revoke a token
      const { data: tokenData } = await api.post("/api/skill/tokens", {
        name: "Revoked Token",
        expiresIn: "never",
      });
      const apiToken = tokenData.data.token;
      
      await api.delete(`/api/skill/tokens/${tokenData.data.id}`);

      // Try to use the revoked token
      const response = await app.fetch(
        new Request("http://localhost/api/transactions", {
          headers: { Authorization: `Bearer ${apiToken}` },
        })
      );

      expect(response.status).toBe(401);
    });
  });
});
