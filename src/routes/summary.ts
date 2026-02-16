import { Hono } from "hono";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { db, transactions, categories } from "../db";

const app = new Hono();

// Get financial summary
app.get("/", async (c) => {
  const { startDate, endDate } = c.req.query();
  
  const conditions = [];
  if (startDate) conditions.push(gte(transactions.date, new Date(startDate)));
  if (endDate) conditions.push(lte(transactions.date, new Date(endDate)));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Total income
  const incomeResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.type, "income"), whereClause));
    
  // Total expenses
  const expenseResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(and(eq(transactions.type, "expense"), whereClause));
    
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
    .where(and(eq(transactions.type, "expense"), whereClause))
    .groupBy(transactions.categoryId, categories.name);
    
  const income = parseFloat(incomeResult[0]?.total || "0");
  const expenses = parseFloat(expenseResult[0]?.total || "0");
  
  return c.json({
    data: {
      income,
      expenses,
      balance: income - expenses,
      byCategory,
    },
  });
});

export default app;
