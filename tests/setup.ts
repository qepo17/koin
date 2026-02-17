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
  await migrate(drizzle(migrationClient), { migrationsFolder: "./drizzle" });
  await migrationClient.end();

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
  await db.delete(schema.users);
}

export function getTestDb() {
  return getDb();
}
