import { Hono } from "hono";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, debtAccounts, debtPayments, debtPaymentAllocations } from "../db";

const app = new Hono();

// List payments for a debt account (with allocations)
app.get("/:accountId/payments", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("accountId");
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20") || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0") || 0, 0);

  // Verify account belongs to user
  const account = await db
    .select()
    .from(debtAccounts)
    .where(and(eq(debtAccounts.id, accountId), eq(debtAccounts.userId, userId)));

  if (account.length === 0) {
    return c.json({ error: "Debt account not found" }, 404);
  }

  const payments = await db
    .select()
    .from(debtPayments)
    .where(eq(debtPayments.accountId, accountId))
    .orderBy(sql`${debtPayments.paidAt} DESC`)
    .limit(limit)
    .offset(offset);

  const paymentIds = payments.map((p) => p.id);
  const allAllocations = paymentIds.length > 0
    ? await db.select().from(debtPaymentAllocations).where(inArray(debtPaymentAllocations.paymentId, paymentIds))
    : [];

  const result = payments.map((payment) => ({
    ...payment,
    allocations: allAllocations.filter((a) => a.paymentId === payment.id),
  }));

  return c.json({ data: result });
});

export default app;
