import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";
import { transactions } from "../db/schema";

export interface UpsertTransactionInput {
  userId: string;
  type: "income" | "expense" | "adjustment";
  amount: string;
  description?: string;
  categoryId?: string | null;
  appliedRuleId?: string | null;
  date: Date;
}

export interface UpsertTransactionResult {
  data: typeof transactions.$inferSelect;
  /** Whether an existing transaction was updated (true) or a new one was inserted (false) */
  upserted: boolean;
}

/**
 * Insert a transaction, or update its category if a duplicate exists.
 *
 * Duplicate key: unique index idx_transactions_dedup on
 *   (user_id, type, amount, date_trunc('day', date AT TIME ZONE 'UTC'), COALESCE(description, ''))
 *
 * On conflict: only categoryId, appliedRuleId, and updatedAt are updated.
 */
export async function upsertTransaction(
  db: PostgresJsDatabase<typeof schema>,
  input: UpsertTransactionInput,
): Promise<UpsertTransactionResult> {
  const { userId, type, amount, description, categoryId, appliedRuleId, date } = input;

  const now = new Date();

  // Use raw SQL for INSERT ... ON CONFLICT on the functional unique index
  const result = await db.execute(sql`
    INSERT INTO transactions (id, user_id, type, amount, description, category_id, applied_rule_id, date, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      ${userId},
      ${type},
      ${amount},
      ${description ?? null},
      ${categoryId ?? null},
      ${appliedRuleId ?? null},
      ${date.toISOString()}::timestamp,
      ${now.toISOString()}::timestamp,
      ${now.toISOString()}::timestamp
    )
    ON CONFLICT (user_id, type, amount, date_trunc('day', date), COALESCE(description, ''))
    DO UPDATE SET
      category_id = COALESCE(EXCLUDED.category_id, transactions.category_id),
      applied_rule_id = COALESCE(EXCLUDED.applied_rule_id, transactions.applied_rule_id),
      updated_at = ${now.toISOString()}::timestamp
    RETURNING *, (xmax = 0) AS is_insert
  `);

  const row = result[0] as any;
  const isInsert = row.is_insert;

  // Map snake_case columns back to camelCase to match the Drizzle schema type
  const data = {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    categoryId: row.category_id,
    appliedRuleId: row.applied_rule_id,
    date: row.date instanceof Date ? row.date : new Date(row.date),
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  } as typeof transactions.$inferSelect;

  return { data, upserted: !isInsert };
}
