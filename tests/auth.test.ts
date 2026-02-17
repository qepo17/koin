import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables } from "./setup";
import { api, createApi, generateTestUser } from "./helpers";

describe("Auth API", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const user = generateTestUser();
      const { status, data } = await api.post("/api/auth/register", user);

      expect(status).toBe(201);
      expect(data.data.user.email).toBe(user.email);
      expect(data.data.user.name).toBe(user.name);
      expect(data.data.token).toBeDefined();
      // Password should not be returned
      expect(data.data.user.passwordHash).toBeUndefined();
      expect(data.data.user.password).toBeUndefined();
    });

    it("should reject duplicate email", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/auth/register", user);

      expect(status).toBe(409);
      expect(data.error).toBe("Email already registered");
    });

    it("should reject invalid email", async () => {
      const { status, data } = await api.post("/api/auth/register", {
        email: "invalid-email",
        password: "password123",
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should reject short password", async () => {
      const { status, data } = await api.post("/api/auth/register", {
        email: "test@example.com",
        password: "short",
      });

      expect(status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("should normalize email to lowercase", async () => {
      const { status, data } = await api.post("/api/auth/register", {
        email: "TEST@EXAMPLE.COM",
        password: "password123",
      });

      expect(status).toBe(201);
      expect(data.data.user.email).toBe("test@example.com");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login with valid credentials", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/auth/login", {
        email: user.email,
        password: user.password,
      });

      expect(status).toBe(200);
      expect(data.data.user.email).toBe(user.email);
      expect(data.data.token).toBeDefined();
    });

    it("should reject invalid email", async () => {
      const { status, data } = await api.post("/api/auth/login", {
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    it("should reject invalid password", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/auth/login", {
        email: user.email,
        password: "wrongpassword",
      });

      expect(status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    it("should be case-insensitive for email", async () => {
      const user = generateTestUser();
      await api.post("/api/auth/register", user);

      const { status, data } = await api.post("/api/auth/login", {
        email: user.email.toUpperCase(),
        password: user.password,
      });

      expect(status).toBe(200);
      expect(data.data.token).toBeDefined();
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return current user with valid token", async () => {
      const user = generateTestUser();
      const registerResult = await api.post("/api/auth/register", user);
      const token = registerResult.data.data.token;

      const authApi = createApi(token);
      const { status, data } = await authApi.get("/api/auth/me");

      expect(status).toBe(200);
      expect(data.data.email).toBe(user.email);
      expect(data.data.name).toBe(user.name);
    });

    it("should reject without token", async () => {
      const { status, data } = await api.get("/api/auth/me");

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should reject with invalid token", async () => {
      const authApi = createApi("invalid-token");
      const { status, data } = await authApi.get("/api/auth/me");

      expect(status).toBe(401);
      expect(data.error).toBe("Invalid or expired token");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      const { status, data } = await api.post("/api/auth/logout", {});

      expect(status).toBe(200);
      expect(data.data.message).toBe("Logged out");
    });
  });
});
