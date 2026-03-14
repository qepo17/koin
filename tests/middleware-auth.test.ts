import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables, getTestDb } from "./setup";
import { createTestUser, createApi, request } from "./helpers";
import { apiTokens } from "../src/db/schema";
import { generateApiToken, hashApiToken, getApiTokenPrefix } from "../src/lib/auth";
import { eq } from "drizzle-orm";

describe("Auth Middleware", () => {
  let userToken: string;
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
    userToken = token;
    userId = response.data?.data?.user?.id;
  });

  describe("JWT authentication", () => {
    it("should accept valid JWT in Authorization header", async () => {
      const { status, data } = await request("/api/transactions", {
        token: userToken,
      });
      expect(status).toBe(200);
    });

    it("should accept valid JWT in Cookie header", async () => {
      const { status } = await request("/api/transactions", {
        headers: { Cookie: `token=${userToken}` },
      });
      expect(status).toBe(200);
    });

    it("should reject missing token", async () => {
      const { status, data } = await request("/api/transactions");
      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject invalid JWT", async () => {
      const { status, data } = await request("/api/transactions", {
        token: "invalid.jwt.token",
      });
      expect(status).toBe(401);
      expect(data.error).toBe("Invalid or expired token");
    });
  });

  describe("API token authentication", () => {
    async function createDbApiToken(opts?: { expiresAt?: Date | null; revokedAt?: Date | null }) {
      const db = getTestDb();
      const rawToken = generateApiToken();
      const tokenHash = await hashApiToken(rawToken);
      const prefix = getApiTokenPrefix(rawToken);

      const [record] = await db
        .insert(apiTokens)
        .values({
          userId,
          name: "Test Token",
          tokenHash,
          tokenPrefix: prefix,
          expiresAt: opts?.expiresAt ?? null,
          revokedAt: opts?.revokedAt ?? null,
        })
        .returning();

      return { rawToken, record };
    }

    it("should accept valid API token", async () => {
      const { rawToken } = await createDbApiToken();

      const { status } = await request("/api/transactions", {
        token: rawToken,
      });
      expect(status).toBe(200);
    });

    it("should reject expired API token", async () => {
      const { rawToken } = await createDbApiToken({
        expiresAt: new Date("2020-01-01"), // expired
      });

      const { status, data } = await request("/api/transactions", {
        token: rawToken,
      });
      expect(status).toBe(401);
      expect(data.error).toBe("Invalid or expired API token");
    });

    it("should reject revoked API token", async () => {
      const { rawToken } = await createDbApiToken({
        revokedAt: new Date(), // revoked
      });

      const { status, data } = await request("/api/transactions", {
        token: rawToken,
      });
      expect(status).toBe(401);
      expect(data.error).toBe("Invalid or expired API token");
    });

    it("should accept API token with future expiry", async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const { rawToken } = await createDbApiToken({
        expiresAt: futureDate,
      });

      const { status } = await request("/api/transactions", {
        token: rawToken,
      });
      expect(status).toBe(200);
    });

    it("should accept API token with no expiry (null)", async () => {
      const { rawToken } = await createDbApiToken({
        expiresAt: null,
      });

      const { status } = await request("/api/transactions", {
        token: rawToken,
      });
      expect(status).toBe(200);
    });

    it("should reject unknown API token", async () => {
      const fakeToken = generateApiToken(); // not in DB

      const { status, data } = await request("/api/transactions", {
        token: fakeToken,
      });
      expect(status).toBe(401);
      expect(data.error).toBe("Invalid or expired API token");
    });

    it("should update lastUsedAt on successful auth", async () => {
      const { rawToken, record } = await createDbApiToken();

      // Use the token
      await request("/api/transactions", { token: rawToken });

      // Wait a bit for fire-and-forget update
      await new Promise((r) => setTimeout(r, 200));

      const db = getTestDb();
      const [updated] = await db
        .select({ lastUsedAt: apiTokens.lastUsedAt })
        .from(apiTokens)
        .where(eq(apiTokens.id, record.id));

      expect(updated.lastUsedAt).not.toBeNull();
    });
  });
});
