import { Hono } from "hono";
import { eq, count, sql, and, isNull, gt } from "drizzle-orm";
import { rateLimiter } from "hono-rate-limiter";
import { db, users, refreshTokens } from "../db";
import { registerSchema, loginSchema } from "../types";
import {
  hashPassword,
  verifyPassword,
  createToken,
  setAuthCookie,
  setRefreshCookie,
  clearAuthCookie,
  clearRefreshCookie,
  getTokenFromRequest,
  getRefreshTokenFromRequest,
  verifyToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../lib/auth";

// Dummy bcrypt hash for timing-safe comparison when user not found
// This is a hash of "dummy_password_for_timing_protection" with cost 10
const DUMMY_HASH = "$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa";

const app = new Hono();

// Rate limiter for auth endpoints: 5 requests per minute per IP
// Skip in test environment to avoid test interference
const authRateLimiter = process.env.NODE_ENV === "test"
  ? async (_c: any, next: () => Promise<void>) => next()
  : rateLimiter({
      windowMs: 60 * 1000, // 1 minute
      limit: 5,
      standardHeaders: "draft-6",
      keyGenerator: (c) => c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown",
      message: { error: "Too many requests, please try again later" },
    });

// Helper: create refresh token and store in DB
async function createAndStoreRefreshToken(userId: string, family?: string): Promise<string> {
  const rawToken = generateRefreshToken();
  const tokenHash = await hashRefreshToken(rawToken);
  const tokenFamily = family || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
    family: tokenFamily,
  });

  // Encode family into the token: family:rawToken
  return `${tokenFamily}:${rawToken}`;
}

// Helper: issue both tokens and set cookies
async function issueTokens(c: any, userId: string, email: string, family?: string) {
  const accessToken = await createToken(userId, email);
  const refreshToken = await createAndStoreRefreshToken(userId, family);

  setAuthCookie(c, accessToken);
  setRefreshCookie(c, refreshToken);

  return { accessToken, refreshToken };
}

app.get("/setup-status", authRateLimiter, async (c) => {
  const [{ value }] = await db.select({ value: count() }).from(users);
  return c.json({ data: { needsSetup: value === 0 } });
});

app.post("/register", authRateLimiter, async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { email, password, name } = parsed.data;
  const passwordHash = await hashPassword(password);

  // Atomic: advisory lock prevents concurrent registration race
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1)`);

    const [{ value: userCount }] = await tx.select({ value: count() }).from(users);
    if (userCount > 0) return null;

    const [user] = await tx
      .insert(users)
      .values({ email: email.toLowerCase(), passwordHash, name })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      });
    return user;
  });

  if (!result) {
    return c.json({ error: "Registration is closed" }, 403);
  }

  const { accessToken: token } = await issueTokens(c, result.id, result.email);

  return c.json({ data: { user: result, token } }, 201);
});

// Login
app.post("/login", authRateLimiter, async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { email, password } = parsed.data;

  // Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  // Always perform bcrypt comparison to prevent timing attacks
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hashToCompare);

  if (!user || !valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Create tokens and set cookies
  const { accessToken: token } = await issueTokens(c, user.id, user.email);

  return c.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        currency: user.currency,
        createdAt: user.createdAt,
      },
      token,
    },
  });
});

// Refresh token endpoint
app.post("/refresh", authRateLimiter, async (c) => {
  // Get refresh token from cookie or request body
  let rawRefreshToken = getRefreshTokenFromRequest(c);

  if (!rawRefreshToken) {
    try {
      const body = await c.req.json();
      rawRefreshToken = body.refreshToken || null;
    } catch {
      // No body, that's fine
    }
  }

  if (!rawRefreshToken) {
    return c.json({ error: "Refresh token required" }, 401);
  }

  // Parse family:token format
  const colonIndex = rawRefreshToken.indexOf(":");
  if (colonIndex === -1) {
    return c.json({ error: "Invalid refresh token format" }, 401);
  }

  const family = rawRefreshToken.slice(0, colonIndex);
  const tokenValue = rawRefreshToken.slice(colonIndex + 1);
  const tokenHash = await hashRefreshToken(tokenValue);

  // Look up the refresh token
  const now = new Date();
  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.family, family)
      )
    );

  if (!storedToken) {
    // Token not found — possible reuse attack. Revoke entire family.
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.family, family),
          isNull(refreshTokens.revokedAt)
        )
      );
    clearAuthCookie(c);
    clearRefreshCookie(c);
    return c.json({ error: "Invalid refresh token — all sessions in this family have been revoked" }, 401);
  }

  // Check if token was already revoked (reuse detection)
  if (storedToken.revokedAt) {
    // Revoke entire family — potential token theft
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(refreshTokens.family, family),
          isNull(refreshTokens.revokedAt)
        )
      );
    clearAuthCookie(c);
    clearRefreshCookie(c);
    return c.json({ error: "Refresh token reuse detected — all sessions in this family have been revoked" }, 401);
  }

  // Check expiration
  if (storedToken.expiresAt < now) {
    return c.json({ error: "Refresh token expired" }, 401);
  }

  // Revoke the current refresh token (rotation)
  await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(eq(refreshTokens.id, storedToken.id));

  // Look up user
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, storedToken.userId));

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  // Issue new token pair with same family
  const { accessToken: token } = await issueTokens(c, user.id, user.email, family);

  return c.json({
    data: {
      token,
      message: "Tokens refreshed successfully",
    },
  });
});

// Logout
app.post("/logout", async (c) => {
  // Revoke refresh token if present
  const rawRefreshToken = getRefreshTokenFromRequest(c);
  if (rawRefreshToken) {
    const colonIndex = rawRefreshToken.indexOf(":");
    if (colonIndex !== -1) {
      const family = rawRefreshToken.slice(0, colonIndex);
      // Revoke all tokens in this family
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.family, family),
            isNull(refreshTokens.revokedAt)
          )
        );
    }
  }

  clearAuthCookie(c);
  clearRefreshCookie(c);
  return c.json({ data: { message: "Logged out" } });
});

// Get current user
app.get("/me", async (c) => {
  const token = getTokenFromRequest(c);

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      currency: users.currency,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, payload.sub));

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ data: user });
});

export default app;
