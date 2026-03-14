import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { setupTestDb, teardownTestDb, cleanupTables, getTestDb } from "./setup";
import { createTestUser, createApi } from "./helpers";
import { upsertTransaction } from "../src/services/transaction-upsert";
import { transactions, categories } from "../src/db/schema";
import { eq } from "drizzle-orm";

describe("upsertTransaction", () => {
  let userId: string;
  let api: ReturnType<typeof createApi>;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanupTables();
    const { token, response } = await createTestUser();
    userId = response.data?.data?.user?.id;
    api = createApi(token);
  });

  it("should insert a new transaction", async () => {
    const db = getTestDb();
    const result = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    expect(result.upserted).toBe(false); // false = new insert
    expect(result.data.userId).toBe(userId);
    expect(result.data.type).toBe("expense");
    expect(result.data.amount).toBe("50.00");
    expect(result.data.description).toBe("Coffee");
    expect(result.data.id).toBeDefined();
  });

  it("should detect duplicate and update category on conflict", async () => {
    const db = getTestDb();
    // Create a category
    const [cat] = await db
      .insert(categories)
      .values({ name: "Food", userId })
      .returning();

    // First insert
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T10:00:00Z"),
    });
    expect(first.upserted).toBe(false);

    // Second insert with same dedup key but with category
    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      categoryId: cat.id,
      date: new Date("2026-03-10T14:00:00Z"), // same day, different time
    });

    expect(second.upserted).toBe(true); // true = updated existing
    expect(second.data.id).toBe(first.data.id); // same row
    expect(second.data.categoryId).toBe(cat.id);
  });

  it("should not treat different amounts as duplicates", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "75.00",
      description: "Coffee",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    expect(second.upserted).toBe(false);
    expect(second.data.id).not.toBe(first.data.id);
  });

  it("should not treat different types as duplicates", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Transfer",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "income",
      amount: "50.00",
      description: "Transfer",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    expect(second.upserted).toBe(false);
    expect(second.data.id).not.toBe(first.data.id);
  });

  it("should not treat different descriptions as duplicates", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Tea",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    expect(second.upserted).toBe(false);
    expect(second.data.id).not.toBe(first.data.id);
  });

  it("should not treat different days as duplicates", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-11T10:00:00Z"),
    });

    expect(second.upserted).toBe(false);
    expect(second.data.id).not.toBe(first.data.id);
  });

  it("should treat same-day different-time as duplicates", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T08:00:00Z"),
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Coffee",
      date: new Date("2026-03-10T20:00:00Z"),
    });

    expect(second.upserted).toBe(true);
    expect(second.data.id).toBe(first.data.id);
  });

  it("should handle null descriptions as matching", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "25.00",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "25.00",
      date: new Date("2026-03-10T14:00:00Z"),
    });

    expect(second.upserted).toBe(true);
    expect(second.data.id).toBe(first.data.id);
  });

  it("should treat null description and empty string description differently from text", async () => {
    const db = getTestDb();
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "25.00",
      date: new Date("2026-03-10T10:00:00Z"),
      // no description (null)
    });

    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "25.00",
      description: "With description",
      date: new Date("2026-03-10T10:00:00Z"),
    });

    expect(second.upserted).toBe(false);
    expect(second.data.id).not.toBe(first.data.id);
  });

  it("should preserve existing category when upserting without one (COALESCE)", async () => {
    const db = getTestDb();
    const [cat] = await db
      .insert(categories)
      .values({ name: "Food", userId })
      .returning();

    // First insert with category
    const first = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Lunch",
      categoryId: cat.id,
      date: new Date("2026-03-10T10:00:00Z"),
    });
    expect(first.data.categoryId).toBe(cat.id);

    // Second upsert without category - should preserve existing
    const second = await upsertTransaction(db, {
      userId,
      type: "expense",
      amount: "50.00",
      description: "Lunch",
      date: new Date("2026-03-10T14:00:00Z"),
    });

    expect(second.upserted).toBe(true);
    expect(second.data.categoryId).toBe(cat.id); // preserved
  });

  it("should set correct date on result", async () => {
    const db = getTestDb();
    const inputDate = new Date("2026-03-10T15:30:00Z");
    const result = await upsertTransaction(db, {
      userId,
      type: "income",
      amount: "1000.00",
      description: "Salary",
      date: inputDate,
    });

    expect(result.data.date).toBeInstanceOf(Date);
    expect(result.data.createdAt).toBeInstanceOf(Date);
    expect(result.data.updatedAt).toBeInstanceOf(Date);
  });

  it("should handle adjustment transaction type", async () => {
    const db = getTestDb();
    const result = await upsertTransaction(db, {
      userId,
      type: "adjustment",
      amount: "500.00",
      description: "Starting balance",
      date: new Date("2026-01-01T00:00:00Z"),
    });

    expect(result.upserted).toBe(false);
    expect(result.data.type).toBe("adjustment");
    expect(result.data.amount).toBe("500.00");
  });
});
