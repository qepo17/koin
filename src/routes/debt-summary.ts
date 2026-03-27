import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db, debtAccounts, debts, debtPayments, transactions } from "../db";
import { checkBillingSchema } from "../types";

const app = new Hono();

// Debt summary
app.get("/summary", async (c) => {
  const userId = c.get("userId");

  const accounts = await db
    .select()
    .from(debtAccounts)
    .where(and(eq(debtAccounts.userId, userId), eq(debtAccounts.status, "active")));

  const allDebts = await db
    .select()
    .from(debts)
    .where(eq(debts.userId, userId));

  const [paidResult] = await db
    .select({ total: sql<string>`COALESCE(SUM(${debtPayments.totalAmount}), 0)` })
    .from(debtPayments)
    .where(eq(debtPayments.userId, userId));

  const totalDebt = allDebts.reduce((sum, d) => sum + Number(d.totalAmount), 0);
  const totalPaid = Number(paidResult.total);
  const activeDebts = allDebts.filter((d) => d.status === "active");
  const monthlyCommitment = activeDebts.reduce((sum, d) => sum + Number(d.monthlyAmount), 0);

  // Upcoming this month - accounts with billing days
  const now = new Date();
  const currentDay = now.getDate();

  const upcomingThisMonth = await Promise.all(
    accounts
      .filter((a) => a.billingDay >= currentDay)
      .map(async (account) => {
        const accountActiveDebts = activeDebts.filter((d) => d.accountId === account.id);
        const totalDue = accountActiveDebts.reduce((sum, d) => sum + Number(d.monthlyAmount), 0);
        return {
          accountId: account.id,
          accountName: account.name,
          totalDue: totalDue.toFixed(2),
          billingDay: account.billingDay,
          debts: accountActiveDebts.map((d) => ({
            name: d.name,
            amount: d.monthlyAmount,
          })),
        };
      })
  );

  // By account breakdown
  const byAccount = accounts.map((account) => {
    const accountDebts = allDebts.filter((d) => d.accountId === account.id);
    const accountActiveDebts = accountDebts.filter((d) => d.status === "active");
    const accountTotalRemaining =
      accountDebts.reduce((sum, d) => sum + Number(d.totalAmount), 0);
    const accountMonthly = accountActiveDebts.reduce((sum, d) => sum + Number(d.monthlyAmount), 0);

    return {
      accountId: account.id,
      accountName: account.name,
      creditor: account.creditor,
      type: account.type,
      totalRemaining: accountTotalRemaining.toFixed(2),
      monthlyCommitment: accountMonthly.toFixed(2),
      activeDebts: accountActiveDebts.length,
    };
  });

  // By type breakdown
  const byType: Record<string, { accounts: number; totalRemaining: string; monthlyTotal: string }> = {};
  for (const account of accounts) {
    const accountDebts = allDebts.filter((d) => d.accountId === account.id);
    const accountActiveDebts = accountDebts.filter((d) => d.status === "active");

    if (!byType[account.type]) {
      byType[account.type] = { accounts: 0, totalRemaining: "0", monthlyTotal: "0" };
    }
    byType[account.type].accounts++;
    byType[account.type].totalRemaining = (
      Number(byType[account.type].totalRemaining) +
      accountDebts.reduce((sum, d) => sum + Number(d.totalAmount), 0)
    ).toFixed(2);
    byType[account.type].monthlyTotal = (
      Number(byType[account.type].monthlyTotal) +
      accountActiveDebts.reduce((sum, d) => sum + Number(d.monthlyAmount), 0)
    ).toFixed(2);
  }

  return c.json({
    data: {
      totalDebt: totalDebt.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalRemaining: (totalDebt - totalPaid).toFixed(2),
      monthlyCommitment: monthlyCommitment.toFixed(2),
      activeAccounts: accounts.length,
      activeDebts: activeDebts.length,
      upcomingThisMonth,
      byAccount,
      byType,
    },
  });
});

// Check billing - create transactions for accounts due on given date
app.post("/check-billing", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = checkBillingSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const date = new Date(parsed.data.date);
  const day = date.getDate();

  // Find accounts with matching billing day and autoTrack enabled
  const accounts = await db
    .select()
    .from(debtAccounts)
    .where(
      and(
        eq(debtAccounts.userId, userId),
        eq(debtAccounts.billingDay, day),
        eq(debtAccounts.autoTrack, true),
        eq(debtAccounts.status, "active")
      )
    );

  const created: Array<{ accountId: string; accountName: string; transactionId: string; amount: string }> = [];

  for (const account of accounts) {
    // Calculate total due from active debts
    const activeDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.accountId, account.id), eq(debts.status, "active")));

    if (activeDebts.length === 0) continue;

    const totalDue = activeDebts.reduce((sum, d) => sum + Number(d.monthlyAmount), 0);

    // Create expense transaction
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        type: "expense",
        amount: totalDue.toFixed(2),
        description: `${account.name} billing`,
        categoryId: account.categoryId,
        date,
      })
      .returning();

    created.push({
      accountId: account.id,
      accountName: account.name,
      transactionId: transaction.id,
      amount: totalDue.toFixed(2),
    });
  }

  return c.json({ data: created });
});

export default app;
