import { z } from "zod";

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
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
  type: z.enum(["income", "expense", "adjustment"]),
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

// Debt account schemas
export const createDebtAccountSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["credit_card", "loan", "other"]),
  creditor: z.string().max(100).optional(),
  creditLimit: z.string().or(z.number()).transform((v) => String(v)).pipe(z.string().refine((v) => Number(v) > 0, "Must be positive")).optional(),
  billingDay: z.number().int().min(1).max(31),
  categoryId: z.string().uuid().optional(),
  autoTrack: z.boolean().optional(),
  description: z.string().optional(),
});

export const updateDebtAccountSchema = createDebtAccountSchema.partial();

// Debt schemas
export const createDebtSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["installment", "revolving", "loan", "other"]),
  totalAmount: z.string().or(z.number()).transform((v) => String(v)).pipe(z.string().refine((v) => Number(v) > 0, "Must be positive")),
  monthlyAmount: z.string().or(z.number()).transform((v) => String(v)).pipe(z.string().refine((v) => Number(v) > 0, "Must be positive")),
  interestRate: z.string().or(z.number()).transform((v) => String(v)).pipe(z.string().refine((v) => Number(v) >= 0 && Number(v) <= 100, "Must be 0-100")).optional(),
  installmentMonths: z.number().int().min(1).optional(),
  installmentStart: z.string().datetime().optional(),
  description: z.string().optional(),
});

export const updateDebtSchema = createDebtSchema.partial();

// Debt billing check schema
export const checkBillingSchema = z.object({
  date: z.string().datetime(),
});

export type CreateDebtAccount = z.infer<typeof createDebtAccountSchema>;
export type UpdateDebtAccount = z.infer<typeof updateDebtAccountSchema>;
export type CreateDebt = z.infer<typeof createDebtSchema>;
export type UpdateDebt = z.infer<typeof updateDebtSchema>;

// Subscription schemas
export const createSubscriptionSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.string().or(z.number()).transform((v) => String(v)).pipe(z.string().refine((v) => Number(v) > 0, "Must be positive")),
  billingCycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  billingDay: z.number().int().min(1).max(31).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  url: z.string().url().optional(),
  autoTrack: z.boolean().optional(),
});

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

export const subscriptionBillingCheckSchema = z.object({
  date: z.string().datetime().optional(),
});

export type CreateSubscription = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;

// Settings schemas
export const updateSettingsSchema = z.object({
  currency: z.string().length(3).toUpperCase().optional(),
  name: z.string().min(1).max(100).optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;
