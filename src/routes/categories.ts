import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, categories } from "../db";
import { createCategorySchema, updateCategorySchema } from "../types";

const app = new Hono();

// List categories
app.get("/", async (c) => {
  const result = await db.select().from(categories);
  return c.json({ data: result });
});

// Get single category
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await db.select().from(categories).where(eq(categories.id, id));
  
  if (result.length === 0) {
    return c.json({ error: "Category not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Create category
app.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const result = await db.insert(categories).values(parsed.data).returning();
  return c.json({ data: result[0] }, 201);
});

// Update category
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const result = await db.update(categories)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();
    
  if (result.length === 0) {
    return c.json({ error: "Category not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Delete category
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await db.delete(categories).where(eq(categories.id, id)).returning();
  
  if (result.length === 0) {
    return c.json({ error: "Category not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

export default app;
