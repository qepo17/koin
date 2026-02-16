import postgres from "postgres";
import * as schema from "../src/db/schema";
import { resetDb, getDb } from "../src/db";

async function createTables(connectionString: string) {
  const migrationClient = postgres(connectionString, { max: 1 });
  
  // Create tables
  await migrationClient`
    DO $$ BEGIN
      CREATE TYPE transaction_type AS ENUM ('income', 'expense');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;
  
  await migrationClient`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6b7280',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  
  await migrationClient`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type transaction_type NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      description TEXT,
      category_id UUID REFERENCES categories(id),
      date TIMESTAMP DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  
  await migrationClient`
    CREATE TABLE IF NOT EXISTS budgets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id UUID REFERENCES categories(id),
      amount DECIMAL(12, 2) NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  
  await migrationClient.end();
}

export async function setupTestDb() {
  // Set test environment
  process.env.NODE_ENV = "test";
  
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required. Run tests with docker-compose.test.yml");
  }
  
  // Reset any existing connection
  resetDb();
  
  // Create tables
  await createTables(connectionString);

  return { db: getDb(), connectionString };
}

export async function teardownTestDb() {
  resetDb();
}

export async function cleanupTables() {
  const db = getDb();
  // Clean up in correct order (respecting foreign keys)
  await db.delete(schema.transactions);
  await db.delete(schema.budgets);
  await db.delete(schema.categories);
}

export function getTestDb() {
  return getDb();
}
