import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createRuleMatchingService, type RuleMatchingService } from "../src/services/rule-matching";
import type { CategoryRule, TransactionInput } from "../src/types/rules";
import { getDb, resetDb } from "../src/db";
import { users, categories, categoryRules } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { setupTestDb, teardownTestDb } from "./setup";

// Helper to create a rule object for unit tests (no DB needed)
function makeRule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return {
    id: "rule-1",
    userId: "user-1",
    categoryId: "cat-1",
    name: "Test Rule",
    conditions: [],
    priority: 0,
    enabled: true,
    matchCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const tx = (description: string, amount: number): TransactionInput => ({ description, amount });

describe("Rule Matching Service", () => {
  // Unit tests - no DB needed, just test evaluateRule
  describe("evaluateRule", () => {
    let service: RuleMatchingService;

    beforeAll(async () => {
      await setupTestDb();
      const db = getDb();
      service = createRuleMatchingService(db);
    });

    afterAll(async () => {
      await teardownTestDb();
    });

    describe("description conditions", () => {
      test("contains - case insensitive (default)", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "contains", value: "coffee", negate: false, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("Morning Coffee at Starbucks", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("COFFEE SHOP", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("Tea shop", 5))).toBe(false);
      });

      test("contains - case sensitive", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "contains", value: "Coffee", negate: false, caseSensitive: true }],
        });
        expect(service.evaluateRule(rule, tx("Morning Coffee", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("morning coffee", 5))).toBe(false);
      });

      test("startsWith", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "startsWith", value: "uber", negate: false, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("Uber Eats order", 20))).toBe(true);
        expect(service.evaluateRule(rule, tx("UBER ride", 15))).toBe(true);
        expect(service.evaluateRule(rule, tx("My Uber ride", 15))).toBe(false);
      });

      test("endsWith", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "endsWith", value: "subscription", negate: false, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("Netflix subscription", 15))).toBe(true);
        expect(service.evaluateRule(rule, tx("Subscription renewal", 15))).toBe(false);
      });

      test("exact", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "exact", value: "Monthly Rent", negate: false, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("monthly rent", 1000))).toBe(true);
        expect(service.evaluateRule(rule, tx("Monthly Rent Payment", 1000))).toBe(false);
      });

      test("exact - case sensitive", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "exact", value: "Monthly Rent", negate: false, caseSensitive: true }],
        });
        expect(service.evaluateRule(rule, tx("Monthly Rent", 1000))).toBe(true);
        expect(service.evaluateRule(rule, tx("monthly rent", 1000))).toBe(false);
      });

      test("negate - contains", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "contains", value: "refund", negate: true, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("Coffee purchase", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("Refund for order", 5))).toBe(false);
      });

      test("negate - startsWith", () => {
        const rule = makeRule({
          conditions: [{ field: "description", operator: "startsWith", value: "transfer", negate: true, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("Coffee purchase", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("Transfer to savings", 100))).toBe(false);
      });
    });

    describe("amount conditions", () => {
      test("eq", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "eq", value: 9.99 }],
        });
        expect(service.evaluateRule(rule, tx("Subscription", 9.99))).toBe(true);
        expect(service.evaluateRule(rule, tx("Subscription", 10))).toBe(false);
      });

      test("gt", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "gt", value: 100 }],
        });
        expect(service.evaluateRule(rule, tx("Big purchase", 150))).toBe(true);
        expect(service.evaluateRule(rule, tx("Small purchase", 100))).toBe(false);
        expect(service.evaluateRule(rule, tx("Tiny purchase", 50))).toBe(false);
      });

      test("lt", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "lt", value: 10 }],
        });
        expect(service.evaluateRule(rule, tx("Small coffee", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("Exact", 10))).toBe(false);
      });

      test("gte", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "gte", value: 100 }],
        });
        expect(service.evaluateRule(rule, tx("Purchase", 100))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 150))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 99))).toBe(false);
      });

      test("lte", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "lte", value: 50 }],
        });
        expect(service.evaluateRule(rule, tx("Purchase", 50))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 30))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 51))).toBe(false);
      });

      test("between", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "between", value: 10, value2: 50 }],
        });
        expect(service.evaluateRule(rule, tx("Purchase", 10))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 30))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 50))).toBe(true);
        expect(service.evaluateRule(rule, tx("Purchase", 9))).toBe(false);
        expect(service.evaluateRule(rule, tx("Purchase", 51))).toBe(false);
      });

      test("between - missing value2 returns false", () => {
        const rule = makeRule({
          conditions: [{ field: "amount", operator: "between", value: 10 }],
        });
        expect(service.evaluateRule(rule, tx("Purchase", 30))).toBe(false);
      });
    });

    describe("combined conditions (AND logic)", () => {
      test("description AND amount", () => {
        const rule = makeRule({
          conditions: [
            { field: "description", operator: "contains", value: "coffee", negate: false, caseSensitive: false },
            { field: "amount", operator: "lt", value: 20 },
          ],
        });
        expect(service.evaluateRule(rule, tx("Coffee at Starbucks", 5))).toBe(true);
        expect(service.evaluateRule(rule, tx("Coffee machine purchase", 200))).toBe(false);
        expect(service.evaluateRule(rule, tx("Tea", 5))).toBe(false);
      });

      test("multiple description conditions", () => {
        const rule = makeRule({
          conditions: [
            { field: "description", operator: "startsWith", value: "uber", negate: false, caseSensitive: false },
            { field: "description", operator: "contains", value: "eats", negate: false, caseSensitive: false },
          ],
        });
        expect(service.evaluateRule(rule, tx("Uber Eats order", 20))).toBe(true);
        expect(service.evaluateRule(rule, tx("Uber ride", 15))).toBe(false);
      });
    });

    describe("edge cases", () => {
      test("disabled rule never matches", () => {
        const rule = makeRule({
          enabled: false,
          conditions: [{ field: "description", operator: "contains", value: "coffee", negate: false, caseSensitive: false }],
        });
        expect(service.evaluateRule(rule, tx("Coffee", 5))).toBe(false);
      });

      test("invalid conditions returns false", () => {
        const rule = makeRule({
          conditions: [{ invalid: true }] as any,
        });
        expect(service.evaluateRule(rule, tx("Coffee", 5))).toBe(false);
      });

      test("empty conditions array returns false", () => {
        const rule = makeRule({ conditions: [] as any });
        expect(service.evaluateRule(rule, tx("Coffee", 5))).toBe(false);
      });
    });
  });

  // Integration tests - uses DB for findMatchingRule
  describe("findMatchingRule", () => {
    let service: RuleMatchingService;
    let userId: string;
    let categoryId: string;
    let categoryId2: string;

    beforeAll(async () => {
      await setupTestDb();
      const db = getDb();
      service = createRuleMatchingService(db);

      // Create a test user
      const [user] = await db.insert(users).values({
        email: `rule-test-${Date.now()}@test.com`,
        passwordHash: "test-hash",
        name: "Rule Test User",
      }).returning();
      userId = user.id;

      // Create test categories
      const [cat1] = await db.insert(categories).values({
        userId,
        name: "Food & Drink",
      }).returning();
      categoryId = cat1.id;

      const [cat2] = await db.insert(categories).values({
        userId,
        name: "Transport",
      }).returning();
      categoryId2 = cat2.id;

      // Create rules with different priorities
      await db.insert(categoryRules).values([
        {
          userId,
          categoryId,
          name: "Coffee Rule",
          conditions: [
            { field: "description", operator: "contains", value: "coffee", negate: false, caseSensitive: false },
          ],
          priority: 10,
          enabled: true,
        },
        {
          userId,
          categoryId: categoryId2,
          name: "Uber Rule",
          conditions: [
            { field: "description", operator: "startsWith", value: "uber", negate: false, caseSensitive: false },
          ],
          priority: 20,
          enabled: true,
        },
        {
          userId,
          categoryId,
          name: "Disabled Rule",
          conditions: [
            { field: "description", operator: "contains", value: "disabled", negate: false, caseSensitive: false },
          ],
          priority: 100,
          enabled: false,
        },
        {
          userId,
          categoryId,
          name: "Expensive Coffee Rule",
          conditions: [
            { field: "description", operator: "contains", value: "coffee", negate: false, caseSensitive: false },
            { field: "amount", operator: "gt", value: 50 },
          ],
          priority: 30, // Higher priority than plain coffee
          enabled: true,
        },
      ]);
    });

    afterAll(async () => {
      const db = getDb();
      await db.delete(categoryRules).where(eq(categoryRules.userId, userId));
      await db.delete(categories).where(eq(categories.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
      await teardownTestDb();
    });

    test("returns matching rule", async () => {
      const result = await service.findMatchingRule(userId, tx("Coffee at Starbucks", 5));
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Coffee Rule");
    });

    test("returns highest priority match (first match wins)", async () => {
      // "Expensive Coffee" has priority 30, "Coffee Rule" has priority 10
      const result = await service.findMatchingRule(userId, tx("Expensive coffee beans", 100));
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Expensive Coffee Rule");
    });

    test("returns null when no match", async () => {
      const result = await service.findMatchingRule(userId, tx("Random purchase", 50));
      expect(result).toBeNull();
    });

    test("skips disabled rules", async () => {
      const result = await service.findMatchingRule(userId, tx("disabled test", 10));
      expect(result).toBeNull();
    });

    test("does not return rules from other users", async () => {
      const result = await service.findMatchingRule("00000000-0000-0000-0000-000000000000", tx("Coffee", 5));
      expect(result).toBeNull();
    });

    test("respects priority ordering", async () => {
      // Uber rule has priority 20, higher than Coffee (10)
      const result = await service.findMatchingRule(userId, tx("Uber Coffee", 5));
      expect(result).not.toBeNull();
      // Uber (priority 20) should match first since it's checked before Coffee (priority 10)
      expect(result!.name).toBe("Uber Rule");
    });
  });
});
