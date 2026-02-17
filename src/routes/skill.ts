import { Hono } from "hono";
import { readFile } from "fs/promises";
import { join } from "path";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { generateApiToken, hashApiToken, getApiTokenPrefix } from "../lib/auth";
import { db, apiTokens } from "../db";

const app = new Hono();

// Path to SKILL.md template
const SKILL_TEMPLATE_PATH = join(import.meta.dir, "../../SKILL.md");

// Schema for creating an API token
const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresIn: z.enum(["never", "7d", "30d", "90d", "1y"]).default("never"),
});

// Generate personalized SKILL.md for the authenticated user
app.get("/download", authMiddleware, async (c) => {
  // Get base URL from env or construct from request
  const baseUrl = process.env.API_BASE_URL || 
    `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}/api`;

  // Read template and replace API_URL placeholder only
  const template = await readFile(SKILL_TEMPLATE_PATH, "utf-8");
  const skillContent = template.replace(/\{\{API_URL\}\}/g, baseUrl);

  return new Response(skillContent, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": "attachment; filename=SKILL.md",
    },
  });
});

// Preview endpoint (returns base URL only)
app.get("/preview", authMiddleware, async (c) => {
  const baseUrl = process.env.API_BASE_URL || 
    `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}/api`;

  return c.json({
    data: {
      baseUrl,
    },
  });
});

// List user's API tokens (without the actual token values)
app.get("/tokens", authMiddleware, async (c) => {
  const userId = c.get("userId");

  const tokens = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      expiresAt: apiTokens.expiresAt,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, userId),
        isNull(apiTokens.revokedAt)
      )
    )
    .orderBy(apiTokens.createdAt);

  return c.json({ data: tokens });
});

// Create a new API token
app.post("/tokens", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { name, expiresIn } = parsed.data;

  // Calculate expiration date
  let expiresAt: Date | null = null;
  if (expiresIn !== "never") {
    const now = new Date();
    const durations: Record<string, number> = {
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
      "1y": 365 * 24 * 60 * 60 * 1000,
    };
    expiresAt = new Date(now.getTime() + durations[expiresIn]);
  }

  // Generate and hash the token
  const token = generateApiToken();
  const tokenHash = await hashApiToken(token);
  const tokenPrefix = getApiTokenPrefix(token);

  // Store in database
  const [created] = await db
    .insert(apiTokens)
    .values({
      userId,
      name,
      tokenHash,
      tokenPrefix,
      expiresAt,
    })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    });

  // Return the token ONCE (it won't be shown again)
  return c.json({
    data: {
      ...created,
      token, // Only returned on creation!
    },
  }, 201);
});

// Revoke an API token
app.delete("/tokens/:id", authMiddleware, async (c) => {
  const userId = c.get("userId");
  const tokenId = c.req.param("id");

  const [revoked] = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.userId, userId),
        isNull(apiTokens.revokedAt)
      )
    )
    .returning({ id: apiTokens.id });

  if (!revoked) {
    return c.json({ error: "Token not found" }, 404);
  }

  return c.json({ data: { message: "Token revoked" } });
});

export default app;
