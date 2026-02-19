import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, users } from "../db";
import { updateSettingsSchema } from "../types";

const app = new Hono<{
  Variables: {
    userId: string;
  };
}>();

// Get user settings
app.get("/", async (c) => {
  const userId = c.get("userId");

  const [user] = await db
    .select({
      currency: users.currency,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ data: user });
});

// Update user settings
app.patch("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: parsed.error.issues }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.currency !== undefined) {
    updates.currency = parsed.data.currency;
  }
  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  updates.updatedAt = new Date();

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning({
      currency: users.currency,
      name: users.name,
    });

  if (!updated) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ data: updated });
});

export default app;
