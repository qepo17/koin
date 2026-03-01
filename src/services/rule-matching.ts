import { eq, and, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";
import { categoryRules } from "../db/schema";
import type { CategoryRule, TransactionInput, Condition, DescriptionCondition, AmountCondition } from "../types/rules";
import { conditionsSchema } from "../types/rules";

export interface ConditionResult {
  field: string;
  operator: string;
  value: unknown;
  matched: boolean;
}

export interface TestRuleResult {
  matches: boolean;
  conditionResults: ConditionResult[];
}

export interface RuleMatchingService {
  findMatchingRule(userId: string, transaction: TransactionInput): Promise<CategoryRule | null>;
  evaluateRule(rule: CategoryRule, transaction: TransactionInput): boolean;
  testRule(rule: CategoryRule, transaction: TransactionInput): TestRuleResult;
}

export function createRuleMatchingService(db: PostgresJsDatabase<typeof schema>): RuleMatchingService {
  function evaluateDescriptionCondition(condition: DescriptionCondition, description: string): boolean {
    const value = condition.caseSensitive ? condition.value : condition.value.toLowerCase();
    const target = condition.caseSensitive ? description : description.toLowerCase();

    let result: boolean;
    switch (condition.operator) {
      case "contains":
        result = target.includes(value);
        break;
      case "startsWith":
        result = target.startsWith(value);
        break;
      case "endsWith":
        result = target.endsWith(value);
        break;
      case "exact":
        result = target === value;
        break;
      default:
        result = false;
    }

    return condition.negate ? !result : result;
  }

  function evaluateAmountCondition(condition: AmountCondition, amount: number): boolean {
    switch (condition.operator) {
      case "eq":
        return amount === condition.value;
      case "gt":
        return amount > condition.value;
      case "lt":
        return amount < condition.value;
      case "gte":
        return amount >= condition.value;
      case "lte":
        return amount <= condition.value;
      case "between":
        if (condition.value2 === undefined) return false;
        return amount >= condition.value && amount <= condition.value2;
      default:
        return false;
    }
  }

  function evaluateCondition(condition: Condition, transaction: TransactionInput): boolean {
    if (condition.field === "description") {
      return evaluateDescriptionCondition(condition, transaction.description);
    }
    if (condition.field === "amount") {
      return evaluateAmountCondition(condition, transaction.amount);
    }
    return false;
  }

  function evaluateRule(rule: CategoryRule, transaction: TransactionInput): boolean {
    if (!rule.enabled) return false;

    const parsed = conditionsSchema.safeParse(rule.conditions);
    if (!parsed.success) return false;

    // All conditions must match (AND logic)
    return parsed.data.every((condition) => evaluateCondition(condition, transaction));
  }

  async function findMatchingRule(userId: string, transaction: TransactionInput): Promise<CategoryRule | null> {
    const rules = await db
      .select()
      .from(categoryRules)
      .where(and(eq(categoryRules.userId, userId), eq(categoryRules.enabled, true)))
      .orderBy(desc(categoryRules.priority));

    for (const row of rules) {
      const rule: CategoryRule = {
        ...row,
        conditions: row.conditions as CategoryRule["conditions"],
      };

      if (evaluateRule(rule, transaction)) {
        return rule;
      }
    }

    return null;
  }

  function testRule(rule: CategoryRule, transaction: TransactionInput): TestRuleResult {
    const parsed = conditionsSchema.safeParse(rule.conditions);
    if (!parsed.success) {
      return { matches: false, conditionResults: [] };
    }

    const conditionResults: ConditionResult[] = parsed.data.map((condition) => {
      const matched = evaluateCondition(condition, transaction);
      if (condition.field === "description") {
        return {
          field: condition.field,
          operator: condition.operator,
          value: condition.value,
          matched,
        };
      }
      return {
        field: condition.field,
        operator: condition.operator,
        value: condition.operator === "between" ? [condition.value, condition.value2] : condition.value,
        matched,
      };
    });

    const matches = !rule.enabled ? false : conditionResults.every((r) => r.matched);

    return { matches, conditionResults };
  }

  return { findMatchingRule, evaluateRule, testRule };
}
