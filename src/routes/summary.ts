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

// Get trend data for charts
app.get("/trend", async (c) => {
  const userId = c.get("userId");
  const { period = "daily", from, to } = c.req.query();

  // Validate period
  if (!["daily", "weekly", "monthly"].includes(period)) {
    return c.json({ error: "Invalid period. Use: daily, weekly, monthly" }, 400);
  }

  // Default date range: last 30 days for daily, last 12 weeks for weekly, last 12 months for monthly
  const now = new Date();
  let defaultFrom: Date;
  
  switch (period) {
    case "weekly":
      defaultFrom = new Date(now);
      defaultFrom.setDate(defaultFrom.getDate() - 84); // 12 weeks
      break;
    case "monthly":
      defaultFrom = new Date(now);
      defaultFrom.setMonth(defaultFrom.getMonth() - 12);
      break;
    default: // daily
      defaultFrom = new Date(now);
      defaultFrom.setDate(defaultFrom.getDate() - 30);
  }

  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : now;

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return c.json({ error: "Invalid date format" }, 400);
  }

  // Set toDate to end of day
  toDate.setHours(23, 59, 59, 999);

  // Build the date truncation SQL based on period
  let dateTrunc: ReturnType<typeof sql>;
  switch (period) {
    case "weekly":
      dateTrunc = sql`DATE_TRUNC('week', ${transactions.date})`;
      break;
    case "monthly":
      dateTrunc = sql`DATE_TRUNC('month', ${transactions.date})`;
      break;
    default: // daily
      dateTrunc = sql`DATE_TRUNC('day', ${transactions.date})`;
  }

  // Get aggregated data by period
  const trendData = await db
    .select({
      date: dateTrunc.as("period_date"),
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      adjustments: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'adjustment' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      gte(transactions.date, fromDate),
      lte(transactions.date, toDate)
    ))
    .groupBy(sql`period_date`)
    .orderBy(sql`period_date`);

  // Calculate running balance
  let runningBalance = 0;
  
  // Get starting balance (all transactions before fromDate)
  const startingBalanceResult = await db
    .select({
      income: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
      expenses: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
      adjustments: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'adjustment' THEN ${transactions.amount} ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      sql`${transactions.date} < ${fromDate.toISOString()}`
    ));

  const startingIncome = parseFloat(startingBalanceResult[0]?.income || "0");
  const startingExpenses = parseFloat(startingBalanceResult[0]?.expenses || "0");
  const startingAdjustments = parseFloat(startingBalanceResult[0]?.adjustments || "0");
  runningBalance = startingIncome - startingExpenses + startingAdjustments;

  const points = trendData.map(row => {
    const income = parseFloat(row.income);
    const expenses = parseFloat(row.expenses);
    const adjustments = parseFloat(row.adjustments);
    runningBalance += income - expenses + adjustments;

    // Handle date - could be Date object or string depending on driver
    const dateValue = row.date;
    let dateStr: string;
    if (dateValue instanceof Date) {
      dateStr = dateValue.toISOString().split("T")[0];
    } else if (typeof dateValue === "string") {
      dateStr = new Date(dateValue).toISOString().split("T")[0];
    } else {
      dateStr = String(dateValue).split("T")[0];
    }

    return {
      date: dateStr,
      income,
      expenses,
      balance: runningBalance,
    };
  });

  return c.json({
    data: {
      period,
      from: fromDate.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
      points,
    },
  });
});

export default app;
