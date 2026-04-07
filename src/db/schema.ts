import { pgTable, uuid, text, decimal, timestamp, pgEnum, index, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense", "adjustment"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["weekly", "monthly", "quarterly", "yearly"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "paused", "cancelled"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  currency: text("currency").notNull().default("USD"),
  privacyMode: boolean("privacy_mode").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6b7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id),
  appliedRuleId: uuid("applied_rule_id").references(() => categoryRules.id, { onDelete: "set null" }),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  period: text("period").notNull().default("monthly"), // monthly, weekly, yearly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Subscription tracker
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  billingCycle: billingCycleEnum("billing_cycle").notNull(),
  billingDay: integer("billing_day").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  description: text("description"),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  url: text("url"),
  autoTrack: boolean("auto_track").notNull().default(true),
  nextBillingDate: timestamp("next_billing_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("subscriptions_user_id_idx").on(table.userId),
  categoryIdIdx: index("subscriptions_category_id_idx").on(table.categoryId),
  nextBillingIdx: index("subscriptions_next_billing_idx").on(table.nextBillingDate),
  userStatusIdx: index("subscriptions_user_status_idx").on(table.userId, table.status),
}));

// API tokens for integrations (AI agents, etc.)
export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(), // e.g., "My AI Agent", "Claude"
  tokenHash: text("token_hash").notNull(), // hashed token for verification
  tokenPrefix: text("token_prefix").notNull(), // first 8 chars for display (koin_xxxx...)
  expiresAt: timestamp("expires_at"), // null = never expires
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"), // null = active, set = revoked
}, (table) => ({
  tokenHashIdx: index("api_tokens_token_hash_idx").on(table.tokenHash),
}));

export const aiCommandStatusEnum = pgEnum("ai_command_status", ["pending", "confirmed", "cancelled", "expired"]);

// AI commands - staged actions awaiting user confirmation
export const aiCommands = pgTable("ai_commands", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  prompt: text("prompt").notNull(), // Original user prompt
  interpretation: text("interpretation").notNull(), // AI's human-readable understanding
  actions: text("actions").notNull(), // JSON: structured operations to perform
  preview: text("preview").notNull(), // JSON: before/after preview data
  status: aiCommandStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(), // Auto-expire pending commands (e.g., 5 min)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"), // When confirmed and executed
  result: text("result"), // JSON: execution result or errors
}, (table) => ({
  userStatusIdx: index("ai_commands_user_status_idx").on(table.userId, table.status),
}));

// Refresh tokens for secure token rotation
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"), // null = active
  family: uuid("family").notNull(), // token family for rotation detection
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: index("refresh_tokens_token_hash_idx").on(table.tokenHash),
  userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
  familyIdx: index("refresh_tokens_family_idx").on(table.family),
}));

// Debt tracker enums
export const debtAccountTypeEnum = pgEnum("debt_account_type", ["credit_card", "loan", "other"]);
export const debtAccountStatusEnum = pgEnum("debt_account_status", ["active", "closed"]);
export const debtTypeEnum = pgEnum("debt_type", ["installment", "revolving", "loan", "other"]);
export const debtStatusEnum = pgEnum("debt_status", ["active", "paid_off", "cancelled"]);

// Debt accounts - credit cards, loans, etc.
export const debtAccounts = pgTable("debt_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  type: debtAccountTypeEnum("type").notNull(),
  creditor: text("creditor"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  billingDay: integer("billing_day").notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  autoTrack: boolean("auto_track").notNull().default(true),
  status: debtAccountStatusEnum("status").notNull().default("active"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("debt_accounts_user_id_idx").on(table.userId),
  categoryIdIdx: index("debt_accounts_category_id_idx").on(table.categoryId),
}));

// Individual debts within an account
export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => debtAccounts.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  type: debtTypeEnum("type").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  monthlyAmount: decimal("monthly_amount", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  installmentMonths: integer("installment_months"),
  installmentStart: timestamp("installment_start"),
  description: text("description"),
  status: debtStatusEnum("status").notNull().default("active"),
  paidOffAt: timestamp("paid_off_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index("debts_account_id_idx").on(table.accountId),
  userIdIdx: index("debts_user_id_idx").on(table.userId),
  accountStatusIdx: index("debts_account_id_status_idx").on(table.accountId, table.status),
}));

// Debt payments linked to transactions
export const debtPayments = pgTable("debt_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => debtAccounts.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  note: text("note"),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }),
  paidAt: timestamp("paid_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  accountIdIdx: index("debt_payments_account_id_idx").on(table.accountId),
  transactionIdIdx: index("debt_payments_transaction_id_idx").on(table.transactionId),
}));

// Payment allocations across individual debts
export const debtPaymentAllocations = pgTable("debt_payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").references(() => debtPayments.id, { onDelete: "cascade" }).notNull(),
  debtId: uuid("debt_id").references(() => debts.id).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  principal: decimal("principal", { precision: 12, scale: 2 }),
  interest: decimal("interest", { precision: 12, scale: 2 }),
}, (table) => ({
  paymentIdIdx: index("debt_payment_allocations_payment_id_idx").on(table.paymentId),
}));

// Category rules - automatic categorization based on conditions
export const categoryRules = pgTable("category_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull(),
  priority: integer("priority").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  matchCount: integer("match_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_category_rules_user_id").on(table.userId),
  userPriorityIdx: index("idx_category_rules_priority").on(table.userId, table.priority),
}));
