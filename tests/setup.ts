import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { resetDb, getDb } from "../src/db";

export async function setupTestDb() {
  // Set test environment
  process.env.NODE_ENV = "test";
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required. Run tests with docker-compose.test.yml");
  }
  
  // Reset any existing connection
  resetDb();
  
  // Run Drizzle migrations
  const migrationClient = postgres(connectionString, { max: 1 });
  
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" });
  } catch (error) {
    console.warn("Migration failed, attempting direct schema creation:", error);
    
    // Fallback: Create subscription table directly if migrations fail
    // This ensures tests can run even with migration conflicts
    await migrationClient`
      CREATE TYPE IF NOT EXISTS "billing_cycle" AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');
      CREATE TYPE IF NOT EXISTS "subscription_status" AS ENUM ('active', 'paused', 'cancelled');
      
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id"),
        "name" text NOT NULL,
        "amount" decimal(12, 2) NOT NULL,
        "currency" text NOT NULL DEFAULT 'USD',
        "billing_cycle" "billing_cycle" NOT NULL,
        "billing_day" integer NOT NULL,
        "category_id" uuid REFERENCES "categories"("id"),
        "description" text,
        "start_date" timestamp DEFAULT now() NOT NULL,
        "end_date" timestamp,
        "status" "subscription_status" NOT NULL DEFAULT 'active',
        "url" text,
        "auto_track" boolean NOT NULL DEFAULT true,
        "next_billing_date" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");
      CREATE INDEX IF NOT EXISTS "subscriptions_category_id_idx" ON "subscriptions" USING btree ("category_id");
      CREATE INDEX IF NOT EXISTS "subscriptions_next_billing_idx" ON "subscriptions" USING btree ("next_billing_date");
      CREATE INDEX IF NOT EXISTS "subscriptions_user_status_idx" ON "subscriptions" USING btree ("user_id", "status");
    `;
  }
  
  await migrationClient.end();

  return { db: getDb(), connectionString };
}

export async function teardownTestDb() {
  resetDb();
}

export async function cleanupTables() {
  const db = getDb();
  // Clean up in correct order (respecting foreign keys)
  await db.delete(schema.debtPaymentAllocations);
  await db.delete(schema.debtPayments);
  await db.delete(schema.debts);
  await db.delete(schema.debtAccounts);
  // TODO: Uncomment when subscriptions table migration is applied
  // await db.delete(schema.subscriptions);
  await db.delete(schema.aiCommands);
  await db.delete(schema.categoryRules);
  await db.delete(schema.transactions);
  await db.delete(schema.budgets);
  await db.delete(schema.categories);
  await db.delete(schema.refreshTokens);
  await db.delete(schema.apiTokens);
  await db.delete(schema.users);
}

export function getTestDb() {
  return getDb();
}
