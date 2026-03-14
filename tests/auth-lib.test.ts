import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { setupTestDb, teardownTestDb } from "./setup";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  generateApiToken,
  hashApiToken,
  getApiTokenPrefix,
  isApiToken,
} from "../src/lib/auth";

describe("Auth Library", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("hashPassword / verifyPassword", () => {
    it("should hash and verify a password", async () => {
      const password = "mysecretpassword123";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should reject wrong password", async () => {
      const hash = await hashPassword("correctpassword");
      const isValid = await verifyPassword("wrongpassword", hash);
      expect(isValid).toBe(false);
    });

    it("should produce different hashes for same password", async () => {
      const hash1 = await hashPassword("samepassword");
      const hash2 = await hashPassword("samepassword");
      expect(hash1).not.toBe(hash2); // different salts
    });
  });

  describe("createToken / verifyToken", () => {
    it("should create and verify a JWT token", async () => {
      const token = await createToken("user-123", "test@example.com");
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const payload = await verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe("user-123");
      expect(payload!.email).toBe("test@example.com");
    });

    it("should include exp and iat in payload", async () => {
      const token = await createToken("user-123", "test@example.com");
      const payload = await verifyToken(token);

      expect(payload!.iat).toBeDefined();
      expect(payload!.exp).toBeDefined();
      expect(payload!.exp).toBeGreaterThan(payload!.iat);
    });

    it("should return null for invalid token", async () => {
      const payload = await verifyToken("invalid-token-string");
      expect(payload).toBeNull();
    });

    it("should return null for empty string", async () => {
      const payload = await verifyToken("");
      expect(payload).toBeNull();
    });

    it("should return null for tampered token", async () => {
      const token = await createToken("user-123", "test@example.com");
      const tampered = token.slice(0, -5) + "xxxxx";
      const payload = await verifyToken(tampered);
      expect(payload).toBeNull();
    });
  });

  describe("generateApiToken", () => {
    it("should start with koin_ prefix", () => {
      const token = generateApiToken();
      expect(token.startsWith("koin_")).toBe(true);
    });

    it("should generate unique tokens", () => {
      const token1 = generateApiToken();
      const token2 = generateApiToken();
      expect(token1).not.toBe(token2);
    });

    it("should generate URL-safe characters", () => {
      const token = generateApiToken();
      // After the prefix, should only contain URL-safe base64 chars
      const body = token.slice(5);
      expect(/^[A-Za-z0-9_-]+$/.test(body)).toBe(true);
    });
  });

  describe("hashApiToken", () => {
    it("should produce a hex string", async () => {
      const token = generateApiToken();
      const hash = await hashApiToken(token);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it("should produce consistent hashes for same input", async () => {
      const token = "koin_testtoken123";
      const hash1 = await hashApiToken(token);
      const hash2 = await hashApiToken(token);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different tokens", async () => {
      const hash1 = await hashApiToken("koin_token1");
      const hash2 = await hashApiToken("koin_token2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("getApiTokenPrefix", () => {
    it("should return first 12 chars with ellipsis", () => {
      const token = "koin_abc123456789xyz";
      expect(getApiTokenPrefix(token)).toBe("koin_abc1234...");
    });
  });

  describe("isApiToken", () => {
    it("should return true for tokens starting with koin_", () => {
      expect(isApiToken("koin_abc123")).toBe(true);
    });

    it("should return false for JWT tokens", () => {
      expect(isApiToken("eyJhbGciOiJIUzI1NiJ9.xxx")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isApiToken("")).toBe(false);
    });
  });
});
