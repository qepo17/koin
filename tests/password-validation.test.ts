import { describe, expect, it } from "bun:test";
import { registerSchema } from "../src/types";

describe("Password strength validation", () => {
  const validBase = { email: "test@example.com", name: "Test" };

  describe("valid passwords", () => {
    const validPasswords = [
      "Abcdef1g",
      "StrongPass1",
      "MyP4ssword",
      "Hello123World",
      "aB3defgh",
      "UPPER1lower",
    ];

    for (const password of validPasswords) {
      it(`accepts "${password}"`, () => {
        const result = registerSchema.safeParse({ ...validBase, password });
        expect(result.success).toBe(true);
      });
    }
  });

  describe("passwords too short", () => {
    it("rejects password shorter than 8 characters", () => {
      const result = registerSchema.safeParse({
        ...validBase,
        password: "Ab1cdef",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("passwords missing uppercase", () => {
    const noUpper = ["abcdefg1", "lowercase1", "no_upper_1"];

    for (const password of noUpper) {
      it(`rejects "${password}" (no uppercase)`, () => {
        const result = registerSchema.safeParse({ ...validBase, password });
        expect(result.success).toBe(false);
        if (!result.success) {
          const messages = result.error.issues.map((i) => i.message);
          expect(messages).toContain(
            "Password must contain at least one uppercase letter"
          );
        }
      });
    }
  });

  describe("passwords missing lowercase", () => {
    const noLower = ["ABCDEFG1", "UPPERCASE1", "NO_LOWER_1"];

    for (const password of noLower) {
      it(`rejects "${password}" (no lowercase)`, () => {
        const result = registerSchema.safeParse({ ...validBase, password });
        expect(result.success).toBe(false);
        if (!result.success) {
          const messages = result.error.issues.map((i) => i.message);
          expect(messages).toContain(
            "Password must contain at least one lowercase letter"
          );
        }
      });
    }
  });

  describe("passwords missing number", () => {
    const noNumber = ["Abcdefgh", "NoNumbers", "StrongButNoDigit"];

    for (const password of noNumber) {
      it(`rejects "${password}" (no number)`, () => {
        const result = registerSchema.safeParse({ ...validBase, password });
        expect(result.success).toBe(false);
        if (!result.success) {
          const messages = result.error.issues.map((i) => i.message);
          expect(messages).toContain(
            "Password must contain at least one number"
          );
        }
      });
    }
  });

  describe("common weak passwords", () => {
    const weakPasswords = [
      "password",
      "12345678",
      "qwerty12",
      "abcdefgh",
      "ABCDEFGH",
      "aaaaaaaa",
    ];

    for (const password of weakPasswords) {
      it(`rejects weak password "${password}"`, () => {
        const result = registerSchema.safeParse({ ...validBase, password });
        expect(result.success).toBe(false);
      });
    }
  });
});
