import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import { rateLimiter } from "hono-rate-limiter";
import { db, users } from "../db";
import { registerSchema, loginSchema } from "../types";
import {
  hashPassword,
  verifyPassword,
  createToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  verifyToken,
} from "../lib/auth";

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

// Setup status (public)
app.get("/setup-status", async (c) => {
  const [{ value }] = await db.select({ value: count() }).from(users);
  return c.json({ data: { needsSetup: value === 0 } });
});

// Register
app.post("/register", authRateLimiter, async (c) => {
  // Only allow registration when no users exist (first-time setup)
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) {
    return c.json({ error: "Registration is closed" }, 403);
  }

  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const { email, password, name } = parsed.data;

  // Check if user exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // Create user
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      name,
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    });

  // Create token and set cookie
  const token = await createToken(user.id, user.email);
  setAuthCookie(c, token);

  return c.json({ data: { user, token } }, 201);
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

  if (!user) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Create token and set cookie
  const token = await createToken(user.id, user.email);
  setAuthCookie(c, token);

  return c.json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
      token,
    },
  });
});

// Logout
app.post("/logout", async (c) => {
  clearAuthCookie(c);
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
