import { Hono } from "hono";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db, transactions, categories } from "../db";

const app = new Hono();

// Get financial summary (scoped to user)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const { startDate, endDate } = c.req.query();
  
  const conditions = [eq(transactions.userId, userId)];
  if (startDate) conditions.push(gte(transactions.date, new Date(startDate)));
  if (endDate) conditions.push(lte(transactions.date, new Date(endDate)));
  
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
