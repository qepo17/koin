import { Hono } from "hono";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, debtAccounts, debts, debtPayments, debtPaymentAllocations } from "../db";
import { createDebtAccountSchema, updateDebtAccountSchema } from "../types";

const app = new Hono();

// List debt accounts (with computed totals)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const { status, type } = c.req.query();

  const conditions = [eq(debtAccounts.userId, userId)];
  if (status) conditions.push(eq(debtAccounts.status, status as "active" | "closed"));
  if (type) conditions.push(eq(debtAccounts.type, type as "credit_card" | "loan" | "other"));

  const accounts = await db
    .select()
    .from(debtAccounts)
    .where(and(...conditions));

  const accountIds = accounts.map((a) => a.id);

  const allDebts = accountIds.length > 0
    ? await db.select().from(debts).where(and(inArray(debts.accountId, accountIds), eq(debts.userId, userId)))
    : [];

  const paymentTotals = accountIds.length > 0
    ? await db
        .select({
          accountId: debtPayments.accountId,
          total: sql<string>`COALESCE(SUM(${debtPayments.totalAmount}), 0)`,
        })
        .from(debtPayments)
        .where(inArray(debtPayments.accountId, accountIds))
        .groupBy(debtPayments.accountId)
    : [];

  const paymentMap = new Map(paymentTotals.map((p) => [p.accountId, Number(p.total)]));

  const result = accounts.map((account) => {
    const accountDebts = allDebts.filter((d) => d.accountId === account.id);
    const totalDebt = accountDebts.reduce((sum, d) => sum + Number(d.totalAmount), 0);
    const totalPaid = paymentMap.get(account.id) || 0;
    const monthlyCommitment = accountDebts
      .filter((d) => d.status === "active")
      .reduce((sum, d) => sum + Number(d.monthlyAmount), 0);

    return {
      ...account,
      totalDebt: totalDebt.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalRemaining: (totalDebt - totalPaid).toFixed(2),
      monthlyCommitment: monthlyCommitment.toFixed(2),
      debtsCount: accountDebts.length,
    };
  });

  return c.json({ data: result });
});

// Create debt account
app.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createDebtAccountSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const result = await db
    .insert(debtAccounts)
    .values({ ...parsed.data, userId })
    .returning();

  return c.json({ data: result[0] }, 201);
});

// Get single debt account with debts and recent payments
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const account = await db
    .select()
    .from(debtAccounts)
    .where(and(eq(debtAccounts.id, id), eq(debtAccounts.userId, userId)));

  if (account.length === 0) {
    return c.json({ error: "Debt account not found" }, 404);
  }

  const accountDebts = await db
    .select()
    .from(debts)
    .where(and(eq(debts.accountId, id), eq(debts.userId, userId)));

  const payments = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.accountId, id))
    .orderBy(sql`${debtPayments.paidAt} DESC`)
    .limit(20);

  const paymentIds = payments.map((p) => p.id);
  const allAllocations = paymentIds.length > 0
    ? await db.select().from(debtPaymentAllocations).where(inArray(debtPaymentAllocations.paymentId, paymentIds))
    : [];

  const paymentsWithAllocations = payments.map((payment) => ({
    ...payment,
    allocations: allAllocations.filter((a) => a.paymentId === payment.id),
  }));

  return c.json({
    data: {
      ...account[0],
      debts: accountDebts,
      recentPayments: paymentsWithAllocations,
    },
  });
});

// Update debt account
app.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateDebtAccountSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const result = await db
    .update(debtAccounts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(debtAccounts.id, id), eq(debtAccounts.userId, userId)))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Debt account not found" }, 404);
  }

  return c.json({ data: result[0] });
});

// Soft-delete (close) debt account
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  // Check for active debts
  const activeDebts = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(debts)
    .where(and(eq(debts.accountId, id), eq(debts.status, "active")));

  if (Number(activeDebts[0].count) > 0) {
    return c.json({ error: "Cannot close account with active debts" }, 400);
  }

  const result = await db
    .update(debtAccounts)
    .set({ status: "closed", updatedAt: new Date() })
    .where(and(eq(debtAccounts.id, id), eq(debtAccounts.userId, userId)))
    .returning();

  if (result.length === 0) {
    return c.json({ error: "Debt account not found" }, 404);
  }

  return c.json({ data: result[0] });
});

export default app;
