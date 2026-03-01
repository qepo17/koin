import { Hono } from "hono";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db, categoryRules, categories } from "../db";
import { getDb } from "../db";
import { createRuleSchema, updateRuleSchema, reorderRulesSchema } from "../types/rules";

const app = new Hono();

// Helper: verify category belongs to user
async function validateCategoryOwnership(categoryId: string, userId: string): Promise<boolean> {
  const result = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)));
  return result.length > 0;
}

// List rules (sorted by priority DESC)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await db
    .select()
    .from(categoryRules)
    .where(eq(categoryRules.userId, userId))
    .orderBy(desc(categoryRules.priority));
  return c.json({ data: result });
});

// Reorder rules
app.post("/reorder", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = reorderRulesSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { ruleIds } = parsed.data;

  // Verify all rule IDs belong to the user
  const existingRules = await db
    .select({ id: categoryRules.id })
    .from(categoryRules)
    .where(and(eq(categoryRules.userId, userId), inArray(categoryRules.id, ruleIds)));

  const existingIds = new Set(existingRules.map((r) => r.id));
  const invalidIds = ruleIds.filter((id) => !existingIds.has(id));

  if (invalidIds.length > 0) {
    return c.json({ error: "Some rule IDs not found", invalidIds }, 400);
  }

  // Update priorities in a transaction: first in array = highest priority
  const database = getDb();
  await database.transaction(async (tx) => {
    for (let i = 0; i < ruleIds.length; i++) {
      const priority = ruleIds.length - i; // First = highest
      await tx
        .update(categoryRules)
        .set({ priority, updatedAt: new Date() })
        .where(and(eq(categoryRules.id, ruleIds[i]), eq(categoryRules.userId, userId)));
    }
  });

  // Return updated rules sorted by priority
  const result = await db
    .select()
    .from(categoryRules)
    .where(eq(categoryRules.userId, userId))
    .orderBy(desc(categoryRules.priority));

  return c.json({ data: result });
});

// Get single rule
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const result = await db
    .select()
    .from(categoryRules)
    .where(and(eq(categoryRules.id, id), eq(categoryRules.userId, userId)));

  if (result.length === 0) {
    return c.json({ error: "Rule not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// Create rule
app.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createRuleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  // Verify category belongs to user
  const categoryOwned = await validateCategoryOwnership(parsed.data.categoryId, userId);
  if (!categoryOwned) {
    return c.json({ error: "Category not found" }, 404);
  }

  const result = await db
    .insert(categoryRules)
    .values({
      userId,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      conditions: parsed.data.conditions,
      priority: parsed.data.priority,
      enabled: parsed.data.enabled,
    })
    .returning();

  return c.json({ data: result[0] }, 201);
});

// Update rule
app.put("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateRuleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  // Check rule exists and belongs to user
  const existing = await db
    .select()
    .from(categoryRules)
    .where(and(eq(categoryRules.id, id), eq(categoryRules.userId, userId)));

  if (existing.length === 0) {
    return c.json({ error: "Rule not found" }, 404);
  }

  // If updating categoryId, verify ownership
  if (parsed.data.categoryId) {
    const categoryOwned = await validateCategoryOwnership(parsed.data.categoryId, userId);
    if (!categoryOwned) {
      return c.json({ error: "Category not found" }, 404);
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
  if (parsed.data.conditions !== undefined) updateData.conditions = parsed.data.conditions;
  if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
  if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;

  const result = await db
    .update(categoryRules)
    .set(updateData)
    .where(and(eq(categoryRules.id, id), eq(categoryRules.userId, userId)))
    .returning();

  return c.json({ data: result[0] });
});

// Delete rule
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const result = await db
    .delete(categoryRules)
    .where(and(eq(categoryRules.id, id), eq(categoryRules.userId, userId)))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Rule not found" }, 404);
  }

  return c.json({ data: result[0] });
});

export default app;
