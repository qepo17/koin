import { Hono } from "hono";
import { eq, and, sql, lte, desc } from "drizzle-orm";
import { db, subscriptions, transactions, categories } from "../db";
import { createSubscriptionSchema, updateSubscriptionSchema, subscriptionBillingCheckSchema } from "../types";

const app = new Hono();

// Helper function to calculate next billing date
function calculateNextBillingDate(startDate: Date, billingCycle: string, billingDay?: number): Date {
  const next = new Date(startDate);
  const day = billingDay || startDate.getDate();
  
  switch (billingCycle) {
    case "weekly":
      // For weekly, billingDay is day of week (1-7, 1=Monday)
      const dayOfWeek = day > 7 ? 1 : day;
      const currentDayOfWeek = next.getDay() === 0 ? 7 : next.getDay();
      const daysUntilBilling = (dayOfWeek - currentDayOfWeek + 7) % 7;
      next.setDate(next.getDate() + (daysUntilBilling === 0 ? 7 : daysUntilBilling));
      break;
      
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      // Handle month-end cases (e.g., billing day 31 in February)
      const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDayOfMonth));
      break;
      
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      const lastDayOfQuarter = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDayOfQuarter));
      break;
      
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      const lastDayOfYear = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDayOfYear));
      break;
  }
  
  return next;
}

// Helper function to advance billing date to next cycle
function advanceBillingDate(currentDate: Date, billingCycle: string, billingDay: number): Date {
  return calculateNextBillingDate(currentDate, billingCycle, billingDay);
}

// List subscriptions (scoped to user)
app.get("/", async (c) => {
  const userId = c.get("userId");
  const status = c.req.query("status") || "active";
  const billingCycle = c.req.query("billingCycle");
  
  // Build where conditions
  let conditions = [eq(subscriptions.userId, userId)];
  
  if (status !== "all") {
    conditions.push(eq(subscriptions.status, status as any));
  }
  
  if (billingCycle) {
    conditions.push(eq(subscriptions.billingCycle, billingCycle as any));
  }

  const query = db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      amount: subscriptions.amount,
      currency: subscriptions.currency,
      billingCycle: subscriptions.billingCycle,
      billingDay: subscriptions.billingDay,
      categoryId: subscriptions.categoryId,
      categoryName: categories.name,
      description: subscriptions.description,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      status: subscriptions.status,
      url: subscriptions.url,
      autoTrack: subscriptions.autoTrack,
      nextBillingDate: subscriptions.nextBillingDate,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .leftJoin(categories, eq(subscriptions.categoryId, categories.id))
    .where(and(...conditions));
  
  const result = await query;
  return c.json({ data: result });
});

// Get subscription summary
app.get("/summary", async (c) => {
  const userId = c.get("userId");
  
  // Get all active subscriptions
  const activeSubs = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      amount: subscriptions.amount,
      billingCycle: subscriptions.billingCycle,
      nextBillingDate: subscriptions.nextBillingDate,
      categoryId: subscriptions.categoryId,
      categoryName: categories.name,
    })
    .from(subscriptions)
    .leftJoin(categories, eq(subscriptions.categoryId, categories.id))
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));
  
  // Calculate totals
  let monthlyTotal = 0;
  const byCycle = { weekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
  const byCategory: Record<string, { categoryId: string | null; categoryName: string | null; monthlyTotal: number; count: number }> = {};
  
  for (const sub of activeSubs) {
    const amount = Number(sub.amount);
    let monthlyAmount = 0;
    
    switch (sub.billingCycle) {
      case "weekly":
        monthlyAmount = amount * 4.33; // ~4.33 weeks per month
        byCycle.weekly += amount;
        break;
      case "monthly":
        monthlyAmount = amount;
        byCycle.monthly += amount;
        break;
      case "quarterly":
        monthlyAmount = amount / 3;
        byCycle.quarterly += amount;
        break;
      case "yearly":
        monthlyAmount = amount / 12;
        byCycle.yearly += amount;
        break;
    }
    
    monthlyTotal += monthlyAmount;
    
    // Group by category
    const catKey = sub.categoryId || "none";
    if (!byCategory[catKey]) {
      byCategory[catKey] = {
        categoryId: sub.categoryId,
        categoryName: sub.categoryName,
        monthlyTotal: 0,
        count: 0,
      };
    }
    byCategory[catKey].monthlyTotal += monthlyAmount;
    byCategory[catKey].count += 1;
  }
  
  // Get upcoming subscriptions this week
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  
  const upcomingThisWeek = activeSubs
    .filter(sub => new Date(sub.nextBillingDate) <= weekFromNow)
    .map(sub => ({
      id: sub.id,
      name: sub.name,
      amount: sub.amount,
      nextBillingDate: sub.nextBillingDate,
    }));
  
  const response = {
    monthlyTotal: monthlyTotal.toFixed(2),
    yearlyTotal: (monthlyTotal * 12).toFixed(2),
    activeCount: activeSubs.length,
    upcomingThisWeek,
    byCategory: Object.values(byCategory).map(cat => ({
      ...cat,
      monthlyTotal: cat.monthlyTotal.toFixed(2),
    })),
    byCycle: {
      weekly: byCycle.weekly.toFixed(2),
      monthly: byCycle.monthly.toFixed(2),
      quarterly: byCycle.quarterly.toFixed(2),
      yearly: byCycle.yearly.toFixed(2),
    },
  };
  
  return c.json({ data: response });
});

// Get single subscription (scoped to user)
app.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      amount: subscriptions.amount,
      currency: subscriptions.currency,
      billingCycle: subscriptions.billingCycle,
      billingDay: subscriptions.billingDay,
      categoryId: subscriptions.categoryId,
      categoryName: categories.name,
      description: subscriptions.description,
      startDate: subscriptions.startDate,
      endDate: subscriptions.endDate,
      status: subscriptions.status,
      url: subscriptions.url,
      autoTrack: subscriptions.autoTrack,
      nextBillingDate: subscriptions.nextBillingDate,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .leftJoin(categories, eq(subscriptions.categoryId, categories.id))
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  
  if (result.length === 0) {
    return c.json({ error: "Subscription not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Create subscription
app.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = createSubscriptionSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const { billingDay, startDate, ...data } = parsed.data;
  const start = startDate ? new Date(startDate) : new Date();
  const day = billingDay || start.getDate();
  
  // Validate billing day based on cycle
  if (data.billingCycle === "weekly" && (day < 1 || day > 7)) {
    return c.json({ error: "Weekly billing day must be 1-7 (1=Monday)" }, 400);
  }
  if (data.billingCycle !== "weekly" && (day < 1 || day > 31)) {
    return c.json({ error: "Billing day must be 1-31" }, 400);
  }
  
  const nextBillingDate = calculateNextBillingDate(start, data.billingCycle, day);
  
  const result = await db
    .insert(subscriptions)
    .values({
      ...data,
      userId,
      startDate: start,
      billingDay: day,
      nextBillingDate,
    })
    .returning();
  
  return c.json({ data: result[0] }, 201);
});

// Update subscription (scoped to user)
app.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateSubscriptionSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  // Get current subscription to calculate new next billing date if needed
  const current = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  
  if (current.length === 0) {
    return c.json({ error: "Subscription not found" }, 404);
  }
  
  const updateData: any = { ...parsed.data, updatedAt: new Date() };
  
  // Recalculate next billing date if amount or billing cycle changed
  if (parsed.data.amount || parsed.data.billingCycle || parsed.data.billingDay) {
    const sub = current[0];
    const newBillingDay = parsed.data.billingDay || sub.billingDay;
    const newBillingCycle = parsed.data.billingCycle || sub.billingCycle;
    
    // Validate billing day
    if (newBillingCycle === "weekly" && (newBillingDay < 1 || newBillingDay > 7)) {
      return c.json({ error: "Weekly billing day must be 1-7 (1=Monday)" }, 400);
    }
    if (newBillingCycle !== "weekly" && (newBillingDay < 1 || newBillingDay > 31)) {
      return c.json({ error: "Billing day must be 1-31" }, 400);
    }
    
    updateData.nextBillingDate = calculateNextBillingDate(
      new Date(),
      newBillingCycle,
      newBillingDay
    );
  }
  
  const result = await db
    .update(subscriptions)
    .set(updateData)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning();
    
  if (result.length === 0) {
    return c.json({ error: "Subscription not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Delete subscription (soft delete - set cancelled and end date)
app.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .update(subscriptions)
    .set({ 
      status: "cancelled",
      endDate: new Date(),
      updatedAt: new Date()
    })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning();
  
  if (result.length === 0) {
    return c.json({ error: "Subscription not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Pause subscription
app.post("/:id/pause", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  const result = await db
    .update(subscriptions)
    .set({ 
      status: "paused",
      updatedAt: new Date()
    })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning();
  
  if (result.length === 0) {
    return c.json({ error: "Subscription not found" }, 404);
  }
  
  return c.json({ data: result[0] });
});

// Resume subscription  
app.post("/:id/resume", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  
  // Get current subscription to recalculate next billing date
  const current = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  
  if (current.length === 0) {
    return c.json({ error: "Subscription not found" }, 404);
  }
  
  const sub = current[0];
  const nextBillingDate = calculateNextBillingDate(
    new Date(),
    sub.billingCycle,
    sub.billingDay
  );
  
  const result = await db
    .update(subscriptions)
    .set({ 
      status: "active",
      nextBillingDate,
      updatedAt: new Date()
    })
    .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
    .returning();
  
  return c.json({ data: result[0] });
});

// Check billing - create transactions for due subscriptions
app.post("/check-billing", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = subscriptionBillingCheckSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }
  
  const targetDate = parsed.data?.date ? new Date(parsed.data.date) : new Date();
  
  // Find all active subscriptions due for billing
  const dueSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active"),
        eq(subscriptions.autoTrack, true),
        lte(subscriptions.nextBillingDate, targetDate)
      )
    );
  
  const processed: any[] = [];
  const skipped: any[] = [];
  
  for (const sub of dueSubscriptions) {
    try {
      // Create expense transaction
      const transaction = await db
        .insert(transactions)
        .values({
          userId,
          type: "expense",
          amount: sub.amount,
          description: `${sub.name} subscription`,
          categoryId: sub.categoryId,
          date: targetDate,
        })
        .returning();
      
      // Advance next billing date
      const nextBillingDate = advanceBillingDate(
        new Date(sub.nextBillingDate),
        sub.billingCycle,
        sub.billingDay
      );
      
      await db
        .update(subscriptions)
        .set({ 
          nextBillingDate,
          updatedAt: new Date()
        })
        .where(eq(subscriptions.id, sub.id));
      
      processed.push({
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        transactionId: transaction[0].id,
        amount: sub.amount,
      });
    } catch (error) {
      skipped.push({
        subscriptionId: sub.id,
        subscriptionName: sub.name,
        reason: "error creating transaction",
      });
    }
  }
  
  // Find paused/cancelled subscriptions that would have been due
  const pausedDue = await db
    .select({ id: subscriptions.id, name: subscriptions.name, status: subscriptions.status })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        lte(subscriptions.nextBillingDate, targetDate),
        sql`${subscriptions.status} != 'active'`
      )
    );
  
  for (const sub of pausedDue) {
    skipped.push({
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      reason: sub.status,
    });
  }
  
  const response = {
    processed: processed.length,
    transactions: processed,
    skipped,
  };
  
  return c.json({ data: response });
});

export default app;