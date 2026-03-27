import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, debtAccounts, debts } from "../db";
import { createDebtSchema, updateDebtSchema } from "../types";

const app = new Hono();

// List debts for an account
app.get("/:accountId/debts", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("accountId");
  const { status } = c.req.query();

  // Verify account belongs to user
  const account = await db
    .select()
    .from(debtAccounts)
    .where(and(eq(debtAccounts.id, accountId), eq(debtAccounts.userId, userId)));

  if (account.length === 0) {
    return c.json({ error: "Debt account not found" }, 404);
  }

  const conditions = [eq(debts.accountId, accountId), eq(debts.userId, userId)];
  if (status) conditions.push(eq(debts.status, status as "active" | "paid_off" | "cancelled"));

  const result = await db
    .select()
    .from(debts)
    .where(and(...conditions));

  return c.json({ data: result });
});

// Create debt
app.post("/:accountId/debts", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("accountId");
  const body = await c.req.json();
  const parsed = createDebtSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  // Verify account belongs to user
  const account = await db
    .select()
    .from(debtAccounts)
    .where(and(eq(debtAccounts.id, accountId), eq(debtAccounts.userId, userId)));

  if (account.length === 0) {
    return c.json({ error: "Debt account not found" }, 404);
  }

  const result = await db
    .insert(debts)
    .values({
      ...parsed.data,
      accountId,
      userId,
      installmentStart: parsed.data.installmentStart
        ? new Date(parsed.data.installmentStart)
        : undefined,
    })
    .returning();

  return c.json({ data: result[0] }, 201);
});

// Update debt
app.patch("/:accountId/debts/:id", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("accountId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateDebtSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { installmentStart, ...rest } = parsed.data;

  const result = await db
    .update(debts)
    .set({
      ...rest,
      ...(installmentStart && { installmentStart: new Date(installmentStart) }),
      updatedAt: new Date(),
    })
    .where(and(eq(debts.id, id), eq(debts.accountId, accountId), eq(debts.userId, userId)))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Debt not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// Cancel debt (soft-delete)
app.delete("/:accountId/debts/:id", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("accountId");
  const id = c.req.param("id");

  const result = await db
    .update(debts)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(debts.id, id), eq(debts.accountId, accountId), eq(debts.userId, userId)))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Debt not found" }, 404);
  }

  return c.json({ data: result[0] });
});

export default app;
