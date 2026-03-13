import { describe, it, expect } from "bun:test";
import { registerSchema } from "../src/types";

describe("Password strength validation", () => {
  const validBase = { email: "test@example.com", name: "Test" };

  const weakPasswords = [
    { password: "short", reason: "too short" },
    { password: "1234567", reason: "too short, digits only" },
    { password: "abcdefgh", reason: "no uppercase, no number" },
    { password: "ABCDEFGH", reason: "no lowercase, no number" },
    { password: "12345678", reason: "no letters" },
    { password: "abcdefg1", reason: "no uppercase" },
    { password: "ABCDEFG1", reason: "no lowercase" },
    { password: "Abcdefgh", reason: "no number" },
    { password: "password", reason: "no uppercase, no number" },
    { password: "PASSWORD", reason: "no lowercase, no number" },
  ];

  const strongPasswords = [
    "Password1",
    "Abcdefg1",
    "Test1234",
    "MyP@ss1!",
    "Str0ngPwd",
    "hEllo123",
  ];

  for (const { password, reason } of weakPasswords) {
    it(`should reject weak password: "${password}" (${reason})`, () => {
      const result = registerSchema.safeParse({ ...validBase, password });
      expect(result.success).toBe(false);
    });
  }

  for (const password of strongPasswords) {
    it(`should accept strong password: "${password}"`, () => {
      const result = registerSchema.safeParse({ ...validBase, password });
      expect(result.success).toBe(true);
    });
  }
});
