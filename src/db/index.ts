import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    client = postgres(connectionString);
    _db = drizzle(client, { schema });
  }
  return _db;
}

// For backwards compatibility and ease of use
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

// Callbacks to run on reset (e.g., service singletons)
const resetCallbacks: (() => void)[] = [];

export function onDbReset(callback: () => void) {
  resetCallbacks.push(callback);
}

// For testing: reset the connection
export function resetDb() {
  if (client) {
    client.end();
  }
  client = null;
  _db = null;
  for (const cb of resetCallbacks) cb();
}

export * from "./schema";
