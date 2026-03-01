import { z } from "zod";

// Condition schemas for category rules

export const descriptionConditionSchema = z.object({
  field: z.literal("description"),
  operator: z.enum(["contains", "startsWith", "endsWith", "exact"]),
  value: z.string(),
  negate: z.boolean().optional().default(false),
  caseSensitive: z.boolean().optional().default(false),
});

export const amountConditionSchema = z.object({
  field: z.literal("amount"),
  operator: z.enum(["eq", "gt", "lt", "gte", "lte", "between"]),
  value: z.number(),
  value2: z.number().optional(), // For "between" operator
});

export const conditionSchema = z.discriminatedUnion("field", [
  descriptionConditionSchema,
  amountConditionSchema,
]);

export const conditionsSchema = z.array(conditionSchema).min(1);

export type DescriptionCondition = z.infer<typeof descriptionConditionSchema>;
export type AmountCondition = z.infer<typeof amountConditionSchema>;
export type Condition = z.infer<typeof conditionSchema>;

export interface CategoryRule {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  conditions: Condition[];
  priority: number;
  enabled: boolean;
  matchCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TransactionInput {
  description: string;
  amount: number;
}

// CRUD schemas
export const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().uuid(),
  conditions: conditionsSchema,
  priority: z.number().int().optional().default(0),
  enabled: z.boolean().optional().default(true),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  conditions: conditionsSchema.optional(),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
});

export const reorderRulesSchema = z.object({
  ruleIds: z.array(z.string().uuid()).min(1),
});

export type CreateRule = z.infer<typeof createRuleSchema>;
export type UpdateRule = z.infer<typeof updateRuleSchema>;
export type ReorderRules = z.infer<typeof reorderRulesSchema>;
