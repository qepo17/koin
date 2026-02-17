import { Hono } from "hono";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { db, transactions } from "../db";
import { createTransactionSchema, updateTransactionSchema } from "../types";

const app = new Hono();

// List transactions (scoped to user)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const { startDate, endDate, type, categoryId } = c.req.query();
  
  const conditions = [eq(transactions.userId, userId)];
  
  if (startDate) conditions.push(gte(transactions.date, new Date(startDate)));
  if (endDate) conditions.push(lte(transactions.date, new Date(endDate)));
  if (type) conditions.push(eq(transactions.type, type as "income" | "expense"));
  if (categoryId) conditions.push(eq(transactions.categoryId, categoryId));
  
  const result = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date));
    
  return c.json({ data: result });
});

// Get single transaction (scoped to user)
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  
  if (result.length === 0) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Create transaction
app.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createTransactionSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const result = await db.insert(transactions).values({
    ...parsed.data,
    userId,
    date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
  }).returning();
  
  return c.json({ data: result[0] }, 201);
});

// Update transaction (scoped to user)
app.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateTransactionSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const { date, ...rest } = parsed.data;
  const result = await db
    .update(transactions)
    .set({ 
      ...rest, 
      ...(date && { date: new Date(date) }),
      updatedAt: new Date() 
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
    
  if (result.length === 0) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Delete transaction (scoped to user)
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning();
  
  if (result.length === 0) {
    return c.json({ error: "Transaction not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

export default app;
