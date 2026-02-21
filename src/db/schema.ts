import { pgTable, uuid, text, decimal, timestamp, pgEnum, index } from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense", "adjustment"]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  currency: text("currency").notNull().default("USD"),
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
