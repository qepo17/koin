import { Hono } from "hono";
import { eq, and, ilike, gte, lte, gt, inArray, sql, desc, type SQL } from "drizzle-orm";
import { db, transactions, categories, aiCommands } from "../db";
import { createOpenRouterClient, OpenRouterValidationError } from "../lib/openrouter";
import { enforceUserScope, logAuditEntry } from "../lib/ai-guardrails";
import type { TransactionFilters, AIAction } from "../types/ai";
import { z } from "zod";

const app = new Hono();

// Command expiry time (5 minutes = 300 seconds)
const COMMAND_EXPIRY_SECONDS = 300;
const COMMAND_EXPIRY_MS = COMMAND_EXPIRY_SECONDS * 1000;

// Rate limiting: 10 requests per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    // Reset or initialize
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  userLimit.count++;
  return { allowed: true };
}

// Request schema
const createCommandSchema = z.object({
  prompt: z.string().min(1).max(500),
});

// Helper: Build transaction query conditions from AI filters
function buildFilterConditions(filters: TransactionFilters, userId: string): SQL[] {
  const conditions: SQL[] = [eq(transactions.userId, userId)];

  if (filters.description_contains) {
    conditions.push(ilike(transactions.description, `%${filters.description_contains}%`));
  }

  if (filters.amount_equals !== undefined) {
    conditions.push(eq(transactions.amount, filters.amount_equals.toString()));
  }

  if (filters.amount_range) {
    conditions.push(gte(transactions.amount, filters.amount_range.min.toString()));
    conditions.push(lte(transactions.amount, filters.amount_range.max.toString()));
  }

  if (filters.date_range) {
    conditions.push(gte(transactions.date, new Date(filters.date_range.start)));
    conditions.push(lte(transactions.date, new Date(filters.date_range.end)));
  }

  if (filters.transaction_type) {
    conditions.push(eq(transactions.type, filters.transaction_type));
  }

  return conditions;
}

// Helper: Find matching transactions
async function findMatchingTransactions(filters: TransactionFilters, userId: string) {
  const conditions = buildFilterConditions(filters, userId);

  // If category_name filter is specified, use trigram similarity to find best match
  if (filters.category_name) {
    // Use pg_trgm similarity - threshold 0.3 is a good balance for fuzzy matching
    // Order by similarity to get the best match
    const category = await db
      .select({ 
        id: categories.id,
        similarity: sql<number>`similarity(${categories.name}, ${filters.category_name})`.as('similarity')
      })
      .from(categories)
      .where(and(
        eq(categories.userId, userId),
        sql`similarity(${categories.name}, ${filters.category_name}) > 0.3`
      ))
      .orderBy(desc(sql`similarity(${categories.name}, ${filters.category_name})`))
      .limit(1);

    if (category.length > 0) {
      conditions.push(eq(transactions.categoryId, category[0].id));
    } else {
      // No matching category - return empty
      return [];
    }
  }

  return db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      categoryId: transactions.categoryId,
      date: transactions.date,
    })
    .from(transactions)
    .where(and(...conditions))
    .limit(100); // Safety limit per #30
}

// Helper: Generate preview records
function generatePreviewRecords(
  matchingTransactions: Array<{
    id: string;
    type: string;
    amount: string;
    description: string | null;
    categoryId: string | null;
    date: Date;
  }>,
  changes: AIAction["changes"],
  categoryLookup: Map<string, string>
) {
  return matchingTransactions.map(tx => {
    const before = {
      description: tx.description,
      category: tx.categoryId ? categoryLookup.get(tx.categoryId) || null : null,
      amount: tx.amount,
    };

    const after = { ...before };
    if (changes.amount) after.amount = changes.amount;
    if (changes.description !== undefined) after.description = changes.description;
    if (changes.categoryId) after.category = categoryLookup.get(changes.categoryId) || changes.categoryId;

    return {
      id: tx.id,
      before,
      after,
    };
  });
}

// POST /api/ai/command - Create a new command (interpret & stage)
app.post("/command", async (c) => {
  const userId = c.get("userId");

  // Rate limiting
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    c.header("Retry-After", String(rateCheck.retryAfter));
    return c.json({ error: "Rate limit exceeded", retryAfter: rateCheck.retryAfter }, 429);
  }

  // Parse request body
  const body = await c.req.json();
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { prompt } = parsed.data;

  try {
    // Get user's categories for context
    const userCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        description: categories.description,
      })
      .from(categories)
      .where(eq(categories.userId, userId));

    // Get user's currency setting
    const userSettings = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      columns: { currency: true },
    });
    const currency = userSettings?.currency || "USD";

    // Create OpenRouter client and interpret prompt
    const client = createOpenRouterClient();
    const interpretation = await client.interpretPrompt(
      prompt,
      userCategories,
      currency,
      userId
    );

    // Enforce user scope on the action
    const scopedAction = enforceUserScope(interpretation.action, userId);

    // Find matching transactions
    const matchingTransactions = await findMatchingTransactions(
      interpretation.action.filters,
      userId
    );

    if (matchingTransactions.length === 0) {
      return c.json({
        error: "No transactions match the specified criteria",
        interpretation: interpretation.interpretation,
        filters: interpretation.action.filters,
      }, 404);
    }

    // Build category lookup for preview
    const categoryLookup = new Map(userCategories.map(cat => [cat.id, cat.name]));

    // Validate target category exists and belongs to user
    if (interpretation.action.changes.categoryId) {
      const targetCategory = userCategories.find(
        c => c.id === interpretation.action.changes.categoryId
      );
      if (!targetCategory) {
        return c.json({
          error: "Target category not found or does not belong to user",
          categoryId: interpretation.action.changes.categoryId,
        }, 400);
      }
    }

    // Generate preview records
    const records = generatePreviewRecords(matchingTransactions, interpretation.action.changes, categoryLookup);

    // Store command in database
    const expiresAt = new Date(Date.now() + COMMAND_EXPIRY_MS);
    const [command] = await db
      .insert(aiCommands)
      .values({
        userId,
        prompt,
        interpretation: interpretation.interpretation,
        actions: JSON.stringify(interpretation.action),
        preview: JSON.stringify(records),
        status: "pending",
        expiresAt,
      })
      .returning();

    return c.json({
      data: {
        commandId: command.id,
        interpretation: interpretation.interpretation,
        preview: {
          matchCount: matchingTransactions.length,
          records,
        },
        expiresIn: COMMAND_EXPIRY_SECONDS,
      },
    }, 201);
  } catch (error) {
    if (error instanceof OpenRouterValidationError) {
      return c.json({
        error: "Failed to interpret command",
        details: error.message,
      }, 400);
    }
    throw error;
  }
});

// GET /api/ai/command/:id - Get command status
app.get("/command/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [command] = await db
    .select()
    .from(aiCommands)
    .where(and(eq(aiCommands.id, id), eq(aiCommands.userId, userId)));

  if (!command) {
    return c.json({ error: "Command not found" }, 404);
  }

  // Check if expired
  const now = new Date();
  const isExpired = command.status === "pending" && now > command.expiresAt;
  const expiresIn = Math.max(0, Math.floor((command.expiresAt.getTime() - now.getTime()) / 1000));

  const records = JSON.parse(command.preview);

  return c.json({
    data: {
      commandId: command.id,
      status: isExpired ? "expired" : command.status,
      prompt: command.prompt,
      interpretation: command.interpretation,
      preview: {
        matchCount: records.length,
        records,
      },
      expiresIn: isExpired ? 0 : expiresIn,
      createdAt: command.createdAt.toISOString(),
      executedAt: command.executedAt?.toISOString() || null,
      result: command.result ? JSON.parse(command.result) : null,
    },
  });
});

// POST /api/ai/command/:id/confirm - Execute a pending command
app.post("/command/:id/confirm", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const now = new Date();

  // Atomically claim the command to prevent race conditions
  // This single UPDATE acts as both status check AND claim
  const [claimed] = await db
    .update(aiCommands)
    .set({ status: "confirmed", executedAt: now })
    .where(and(
      eq(aiCommands.id, id),
      eq(aiCommands.userId, userId),
      eq(aiCommands.status, "pending"),
      gt(aiCommands.expiresAt, now)
    ))
    .returning();

  if (!claimed) {
    // Command not found, not owned by user, already processed, or expired
    // Fetch to determine the specific error
    const [command] = await db
      .select({ status: aiCommands.status, expiresAt: aiCommands.expiresAt })
      .from(aiCommands)
      .where(and(eq(aiCommands.id, id), eq(aiCommands.userId, userId)));

    if (!command) {
      return c.json({ error: "Command not found" }, 404);
    }
    if (command.status !== "pending") {
      return c.json({ error: `Command is already ${command.status}` }, 400);
    }
    if (now > command.expiresAt) {
      await db.update(aiCommands).set({ status: "expired" }).where(eq(aiCommands.id, id));
      return c.json({ error: "Command has expired" }, 400);
    }
    // Shouldn't reach here, but handle gracefully
    return c.json({ error: "Failed to confirm command" }, 400);
  }

  // Parse the action from claimed command
  const action = JSON.parse(claimed.actions) as AIAction;
  const records = JSON.parse(claimed.preview) as Array<{ id: string }>;

  // Execute the updates
  const transactionIds = records.map(r => r.id);
  const changes: Record<string, unknown> = { updatedAt: now };

  if (action.changes.categoryId) changes.categoryId = action.changes.categoryId;
  if (action.changes.amount) changes.amount = action.changes.amount;
  if (action.changes.description !== undefined) changes.description = action.changes.description;
  if (action.changes.type) changes.type = action.changes.type;

  // Batch update all matching transactions
  const result = await db
    .update(transactions)
    .set(changes)
    .where(and(
      inArray(transactions.id, transactionIds),
      eq(transactions.userId, userId)
    ))
    .returning({ id: transactions.id });
  const updatedCount = result.length;

  // Update command with execution result
  const executionResult = {
    success: true,
    updatedCount,
    updatedAt: now.toISOString(),
  };

  await db
    .update(aiCommands)
    .set({ result: JSON.stringify(executionResult) })
    .where(eq(aiCommands.id, id));

  // Log audit entry
  logAuditEntry({
    userId,
    action: "action_executed",
    prompt: claimed.prompt,
    affectedTransactions: updatedCount,
    success: true,
  });

  return c.json({
    data: {
      commandId: claimed.id,
      status: "confirmed",
      updatedCount,
      message: `Successfully updated ${updatedCount} transaction(s)`,
    },
  });
});

// POST /api/ai/command/:id/cancel - Cancel a pending command
app.post("/command/:id/cancel", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  // Get the command
  const [command] = await db
    .select()
    .from(aiCommands)
    .where(and(eq(aiCommands.id, id), eq(aiCommands.userId, userId)));

  if (!command) {
    return c.json({ error: "Command not found" }, 404);
  }

  // Check status
  if (command.status !== "pending") {
    return c.json({ error: `Command is already ${command.status}` }, 400);
  }

  // Update status to cancelled
  await db
    .update(aiCommands)
    .set({ status: "cancelled" })
    .where(eq(aiCommands.id, id));

  return c.json({
    data: {
      commandId: command.id,
      status: "cancelled",
      message: "Command cancelled successfully",
    },
  });
});

// Export for testing - reset rate limit map
export function resetRateLimits() {
  rateLimitMap.clear();
}

export default app;
