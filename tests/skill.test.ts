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
    it("should return SKILL.md with user token", async () => {
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
      expect(content).toContain("API_URL:");
      expect(content).toContain("API_TOKEN:");
      // Should not contain placeholders
      expect(content).not.toContain("{{API_URL}}");
      expect(content).not.toContain("{{API_TOKEN}}");
    });

    it("should return 401 without authentication", async () => {
      const response = await app.fetch(
        new Request("http://localhost/api/skill/download")
      );
      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/skill/preview", () => {
    it("should return preview with base URL and token preview", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.get("/api/skill/preview");

      expect(status).toBe(200);
      expect(data.data).toHaveProperty("baseUrl");
      expect(data.data).toHaveProperty("tokenPreview");
      expect(data.data.baseUrl).toContain("/api");
      // Token preview should be truncated
      expect(data.data.tokenPreview).toContain("...");
    });

    it("should return 401 without authentication", async () => {
      // Clear cookies by creating new api instance
      const unauthApi = createTestApi();
      const { status } = await unauthApi.get("/api/skill/preview");
      expect(status).toBe(401);
    });
  });
});
