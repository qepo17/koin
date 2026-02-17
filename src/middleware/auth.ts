import { createMiddleware } from "hono/factory";
import { getTokenFromRequest, verifyToken, type JWTPayload } from "../lib/auth";

// Extend Hono context with user
declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload;
    userId: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getTokenFromRequest(c);
  
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const payload = await verifyToken(token);
  
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
  
  c.set("user", payload);
  c.set("userId", payload.sub);
  
  await next();
});
