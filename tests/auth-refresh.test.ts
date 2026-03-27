import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { api, createApi, generateTestUser, request } from "./helpers";

/**
 * Extract refresh_token cookie from a Hono Response.
 */
function extractRefreshToken(response: Response): string | null {
  // Try getSetCookie (standard multi-cookie method)
  const cookies = (response.headers as any).getSetCookie?.() || [];
  for (const cookie of cookies) {
    const match = cookie.match(/refreshToken=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  // Fallback: single set-cookie header
  const setCookie = response.headers.get("set-cookie") || "";
  const match = setCookie.match(/refreshToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

describe("Auth Refresh & Setup Status", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  // ── SETUP STATUS ────────────────────────────────────────

  describe("GET /api/auth/setup-status", () => {
    it("should return needsSetup true when no users exist", async () => {
      const { status, data } = await api.get("/api/auth/setup-status");
      expect(status).toBe(200);
      expect(data.data.needsSetup).toBe(true);
    });

    it("should return needsSetup false after registration", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.get("/api/auth/setup-status");
      expect(status).toBe(200);
      expect(data.data.needsSetup).toBe(false);
    });
  });

  // ── REFRESH TOKEN ───────────────────────────────────────

  describe("POST /api/auth/refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      const user = generateTestUser();
      const registerResult = await request("/api/auth/register", {
        method: "POST",
        body: user,
      });

      const refreshToken = extractRefreshToken(registerResult.response);
      expect(refreshToken).toBeTruthy();

      const { status, data } = await api.post("/api/auth/refresh", {
        refreshToken,
      });

      expect(status).toBe(200);
      expect(data.data.token).toBeDefined();
      expect(data.data.message).toBe("Tokens refreshed successfully");
    });

    it("should return a working access token", async () => {
      const user = generateTestUser();
      const registerResult = await request("/api/auth/register", {
        method: "POST",
        body: user,
      });

      const refreshToken = extractRefreshToken(registerResult.response);
      const { data: refreshData } = await api.post("/api/auth/refresh", {
        refreshToken,
      });

      // Use the new access token
      const authedApi = createApi(refreshData.data.token);
      const { status } = await authedApi.get("/api/auth/me");
      expect(status).toBe(200);
    });

    it("should rotate: old refresh token becomes invalid", async () => {
      const user = generateTestUser();
      const registerResult = await request("/api/auth/register", {
        method: "POST",
        body: user,
      });

      const originalRefreshToken = extractRefreshToken(registerResult.response);
      expect(originalRefreshToken).toBeTruthy();

      // First refresh — should succeed
      const { status: firstStatus } = await api.post("/api/auth/refresh", {
        refreshToken: originalRefreshToken,
      });
      expect(firstStatus).toBe(200);

      // Second refresh with same token — should fail (already rotated)
      const { status: secondStatus, data: secondData } = await api.post(
        "/api/auth/refresh",
        { refreshToken: originalRefreshToken }
      );
      expect(secondStatus).toBe(401);
      expect(secondData.error).toContain("revoked");
    });

    it("should detect reuse and revoke entire family", async () => {
      const user = generateTestUser();
      const registerResult = await request("/api/auth/register", {
        method: "POST",
        body: user,
      });

      const originalRefreshToken = extractRefreshToken(registerResult.response);

      // Rotate once — get new refresh token
      const refreshResult = await request("/api/auth/refresh", {
        method: "POST",
        body: { refreshToken: originalRefreshToken },
      });
      expect(refreshResult.status).toBe(200);

      const newRefreshToken = extractRefreshToken(refreshResult.response);

      // Reuse original (stolen) token — triggers family revocation
      const { status: reuseStatus } = await api.post("/api/auth/refresh", {
        refreshToken: originalRefreshToken,
      });
      expect(reuseStatus).toBe(401);

      // Now even the legitimate new token should be revoked
      if (newRefreshToken) {
        const { status: legitimateStatus } = await api.post("/api/auth/refresh", {
          refreshToken: newRefreshToken,
        });
        expect(legitimateStatus).toBe(401);
      }
    });

    it("should reject missing refresh token", async () => {
      const { status } = await api.post("/api/auth/refresh", {});
      expect(status).toBe(401);
    });

    it("should reject invalid format (no colon)", async () => {
      const { status, data } = await api.post("/api/auth/refresh", {
        refreshToken: "invalid-token-no-colon",
      });
      // The token has no colon so it's treated as invalid format
      // But the code checks colonIndex === -1 which returns 401
      expect(status).toBe(401);
    });

    it("should reject non-existent refresh token", async () => {
      const { status } = await api.post("/api/auth/refresh", {
        refreshToken: "00000000-0000-0000-0000-000000000000:faketoken",
      });
      expect(status).toBe(401);
    });
  });

  // ── LOGOUT ──────────────────────────────────────────────

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      const { status, data } = await api.post("/api/auth/logout", {});
      expect(status).toBe(200);
      expect(data.data.message).toBe("Logged out");
    });

    it("should revoke refresh tokens on logout", async () => {
      const user = generateTestUser();
      const registerResult = await request("/api/auth/register", {
        method: "POST",
        body: user,
      });

      const refreshToken = extractRefreshToken(registerResult.response);
      expect(refreshToken).toBeTruthy();

      // Logout with refresh token in cookie header
      // Note: must bypass the helper's Content-Type to avoid body parsing issues
      const logoutResult = await request("/api/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `refreshToken=${refreshToken}`,
        },
      });
      expect(logoutResult.status).toBe(200);

      // Refresh token should no longer work
      const { status } = await api.post("/api/auth/refresh", {
        refreshToken,
      });
      expect(status).toBe(401);
    });
  });

  // ── LOGIN REFRESH FLOW ─────────────────────────────────

  describe("Login + Refresh flow", () => {
    it("should get refresh token from login and use it", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const loginResult = await request("/api/auth/login", {
        method: "POST",
        body: { email: user.email, password: user.password },
      });

      expect(loginResult.status).toBe(200);
      const refreshToken = extractRefreshToken(loginResult.response);
      expect(refreshToken).toBeTruthy();

      const { status, data } = await api.post("/api/auth/refresh", {
        refreshToken,
      });
      expect(status).toBe(200);
      expect(data.data.token).toBeDefined();
    });
  });
});
