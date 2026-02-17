import { Hono } from "hono";
import { eq } from "drizzle-orm";
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

// Register
app.post("/register", async (c) => {
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
app.post("/login", async (c) => {
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
