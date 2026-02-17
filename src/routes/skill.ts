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
  const user = c.get("user");
  
  // Generate a long-lived API token for the skill
  const apiToken = await createToken(user.sub, user.email);
  
  // Get base URL from env or construct from request
  const baseUrl = process.env.API_BASE_URL || 
    `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}/api`;

  // Read template and replace placeholders
  const template = await readFile(SKILL_TEMPLATE_PATH, "utf-8");
  const skillContent = template
    .replace(/\{\{API_URL\}\}/g, baseUrl)
    .replace(/\{\{API_TOKEN\}\}/g, apiToken);

  return new Response(skillContent, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": "attachment; filename=SKILL.md",
    },
  });
});

// Preview endpoint (returns JSON with the values)
app.get("/preview", authMiddleware, async (c) => {
  const user = c.get("user");
  
  const apiToken = await createToken(user.sub, user.email);
  const baseUrl = process.env.API_BASE_URL || 
    `${c.req.header("x-forwarded-proto") || "http"}://${c.req.header("host")}/api`;

  return c.json({
    data: {
      baseUrl,
      tokenPreview: `${apiToken.slice(0, 20)}...${apiToken.slice(-10)}`,
    },
  });
});

export default app;
