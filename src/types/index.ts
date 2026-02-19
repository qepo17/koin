import { z } from "zod";

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type Register = z.infer<typeof registerSchema>;
export type Login = z.infer<typeof loginSchema>;

// Transaction schemas
export const createTransactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.string().or(z.number()).transform((v) => String(v)),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  date: z.string().datetime().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

// Category schemas
export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// Budget schemas
export const createBudgetSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amount: z.string().or(z.number()).transform((v) => String(v)),
  period: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
});

export const updateBudgetSchema = createBudgetSchema.partial();

// Query schemas
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
export type CreateCategory = z.infer<typeof createCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type CreateBudget = z.infer<typeof createBudgetSchema>;
export type UpdateBudget = z.infer<typeof updateBudgetSchema>;

// Settings schemas
export const updateSettingsSchema = z.object({
  currency: z.string().length(3).toUpperCase().optional(),
  name: z.string().min(1).max(100).optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
