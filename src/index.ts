import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import auth from "./routes/auth";
import transactions from "./routes/transactions";
import categories from "./routes/categories";
import summary from "./routes/summary";
import skill from "./routes/skill";
import settings from "./routes/settings";
import ai from "./routes/ai";
import { authMiddleware } from "./middleware/auth";
import { validateOpenRouterEnv } from "./lib/openrouter";

// Validate environment on startup
validateOpenRouterEnv();

export const app = new Hono();

// Middleware - skip logger in test environment
if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}
app.use("*", cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

// Health check
app.get("/", (c) => {
  return c.json({
    name: "koin",
    version: "0.1.0",
    status: "ok",
  });
});

// Public routes
app.route("/api/auth", auth);

// Protected routes
app.use("/api/transactions/*", authMiddleware);
app.use("/api/categories/*", authMiddleware);
app.use("/api/summary/*", authMiddleware);
app.use("/api/settings/*", authMiddleware);
app.use("/api/settings", authMiddleware);
app.use("/api/ai/*", authMiddleware);

app.route("/api/transactions", transactions);
app.route("/api/categories", categories);
app.route("/api/summary", summary);
app.route("/api/settings", settings);
app.route("/api/skill", skill);
app.route("/api/ai", ai);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env.PORT || "3000");

// Only log when not in test mode
if (process.env.NODE_ENV !== "test") {
  console.log(`🪙 Koin API running on http://localhost:${port}`);
}

export default {
  port,
  fetch: app.fetch,
};
