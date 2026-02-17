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
    it("should return SKILL.md with API URL but not token", async () => {
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
      // Should not contain API_URL placeholder
      expect(content).not.toContain("{{API_URL}}");
      // Token should NOT be embedded (user stores it separately)
      expect(content).toContain("<your-token-here>");
    });

    it("should return 401 without authentication", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/skill/download")
      );
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/skill/preview", () => {
    it("should return preview with base URL only", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.get("/api/skill/preview");

      expect(status).toBe(200);
      expect(data.data).toHaveProperty("baseUrl");
      expect(data.data.baseUrl).toContain("/api");
      // Should NOT have token in preview
      expect(data.data).not.toHaveProperty("token");
      expect(data.data).not.toHaveProperty("tokenPreview");
    });

    it("should return 401 without authentication", async () => {
      const unauthApi = createTestApi();
      const { status } = await unauthApi.get("/api/skill/preview");
      expect(status).toBe(401);
    });
  });

  describe("POST /api/skill/token", () => {
    it("should generate a new API token", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/skill/token", {});

      expect(status).toBe(200);
      expect(data.data).toHaveProperty("token");
      expect(typeof data.data.token).toBe("string");
      expect(data.data.token.length).toBeGreaterThan(50);
    });

    it("should return 401 without authentication", async () => {
      const unauthApi = createTestApi();
      const { status } = await unauthApi.post("/api/skill/token", {});
      expect(status).toBe(401);
    });
  });
});
