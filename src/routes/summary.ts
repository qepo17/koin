import { Hono } from "hono";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db, transactions, categories } from "../db";

const app = new Hono();

// Get financial summary (scoped to user)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const { from, to } = c.req.query();
  
  const conditions = [eq(transactions.userId, userId)];
  
  // Date filtering - expects ISO format (YYYY-MM-DD)
  if (from) {
    const fromDate = new Date(from);
    if (!isNaN(fromDate.getTime())) {
      conditions.push(gte(transactions.date, fromDate));
    }
  }
  if (to) {
    const toDate = new Date(to);
    if (!isNaN(toDate.getTime())) {
      // Include the entire "to" day by setting to end of day
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(transactions.date, toDate));
    }
  }
  
  const baseWhere = and(...conditions);
  
  // Total income
  const incomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(baseWhere, eq(transactions.type, "income")));
    
  // Total expenses
  const expenseResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(baseWhere, eq(transactions.type, "expense")));

  // Total adjustments (can be positive or negative)
  const adjustmentResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(baseWhere, eq(transactions.type, "adjustment")));
    
  // Expenses by category
  const byCategory = await db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      total: sql<string>`SUM(${transactions.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(baseWhere, eq(transactions.type, "expense")))
    .groupBy(transactions.categoryId, categories.name);
    
  const income = parseFloat(incomeResult[0]?.total || "0");
  const expenses = parseFloat(expenseResult[0]?.total || "0");
  const adjustments = parseFloat(adjustmentResult[0]?.total || "0");
  
  return c.json({
    data: {
      income,
      expenses,
      adjustments,
      balance: income - expenses + adjustments,
      byCategory,
    },
  });
});

export default app;
