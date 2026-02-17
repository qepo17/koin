import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import transactions from "./routes/transactions";
import categories from "./routes/categories";
import summary from "./routes/summary";

export const app = new Hono();

// Middleware - skip logger in test environment
if (process.env.NODE_ENV !== "test") {
  app.use("*", logger());
}
app.use("*", cors());

// Health check
app.get("/", (c) => {
  return c.json({
    name: "koin",
    version: "0.1.0",
    status: "ok",
  });
});

// Routes
app.route("/api/transactions", transactions);
app.route("/api/categories", categories);
app.route("/api/summary", summary);

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
