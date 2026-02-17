import { Hono } from "hono";
import { readFile } from "fs/promises";
import { join } from "path";
import { authMiddleware } from "../middleware/auth";
import { createToken } from "../lib/auth";

const app = new Hono();

// Path to SKILL.md template
const SKILL_TEMPLATE_PATH = join(import.meta.dir, "../../SKILL.md");

// Generate personalized SKILL.md for the authenticated user
app.get("/download", authMiddleware, async (c) => {
  // Get base URL from env or construct from request
  const baseUrl = process.env.API_BASE_URL || 
    `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}/api`;

  // Read template and replace API_URL placeholder only
  // Token is NOT embedded - user should store it securely in env vars
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

// Generate a new API token for the user
app.post("/token", authMiddleware, async (c) => {
  const user = c.get("user");
  
  // Generate a long-lived API token
  const apiToken = await createToken(user.sub, user.email);

  return c.json({
    data: {
      token: apiToken,
    },
  });
});

export default app;
