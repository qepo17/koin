import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db, debtAccounts, debtPayments, debtPaymentAllocations } from "../db";

const app = new Hono();

// List payments for a debt account (with allocations)
app.get("/:accountId/payments", async (c) => {
  const userId = c.get("userId");
  const accountId = c.req.param("accountId");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = parseInt(c.req.query("offset") || "0");

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

  const result = await Promise.all(
    payments.map(async (payment) => {
      const allocations = await db
        .select()
        .from(debtPaymentAllocations)
        .where(eq(debtPaymentAllocations.paymentId, payment.id));
      return { ...payment, allocations };
    })
  );

  return c.json({ data: result });
});

export default app;
