import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, categories } from "../db";
import { createCategorySchema, updateCategorySchema } from "../types";

const app = new Hono();

// List categories (scoped to user)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  return c.json({ data: result });
});

// Get single category (scoped to user)
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
  
  if (result.length === 0) {
    return c.json({ error: "Category not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Create category
app.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const result = await db
    .insert(categories)
    .values({ ...parsed.data, userId })
    .returning();
  return c.json({ data: result[0] }, 201);
});

// Update category (scoped to user)
app.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const result = await db
    .update(categories)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
    
  if (result.length === 0) {
    return c.json({ error: "Category not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Delete category (scoped to user)
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();
  
  if (result.length === 0) {
    return c.json({ error: "Category not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

export default app;
