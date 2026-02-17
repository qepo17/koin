import { createMiddleware } from "hono/factory";
import { eq, and, isNull, or, gt } from "drizzle-orm";
import { getTokenFromRequest, verifyToken, isApiToken, hashApiToken, type JWTPayload } from "../lib/auth";
import { db, apiTokens, users } from "../db";

// Extend Hono context with user
declare module "hono" {
  interface ContextVariableMap {
    user: JWTPayload;
    userId: string;
    tokenType: "session" | "api";
    apiTokenId?: string;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getTokenFromRequest(c);
  
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  // Check if it's an API token (starts with "koin_")
  if (isApiToken(token)) {
    const result = await verifyApiToken(token);
    if (!result) {
      return c.json({ error: "Invalid or expired API token" }, 401);
    }
    
    c.set("user", {
      sub: result.userId,
      email: result.email,
      iat: Math.floor(Date.now() / 1000),
      exp: result.expiresAt ? Math.floor(result.expiresAt.getTime() / 1000) : 0,
    });
    c.set("userId", result.userId);
    c.set("tokenType", "api");
    c.set("apiTokenId", result.tokenId);
  } else {
    // JWT session token
    const payload = await verifyToken(token);
    
    if (!payload) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }
    
    c.set("user", payload);
    c.set("userId", payload.sub);
    c.set("tokenType", "session");
  }
  
  await next();
});

// Verify an API token against the database
async function verifyApiToken(token: string): Promise<{
  tokenId: string;
  userId: string;
  email: string;
  expiresAt: Date | null;
} | null> {
  const tokenHash = await hashApiToken(token);
  
  const now = new Date();
  
  // Find token that:
  // 1. Matches the hash
  // 2. Not revoked
  // 3. Not expired (or no expiry)
  const [apiToken] = await db
    .select({
      id: apiTokens.id,
      userId: apiTokens.userId,
      expiresAt: apiTokens.expiresAt,
    })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.tokenHash, tokenHash),
        isNull(apiTokens.revokedAt),
        or(
          isNull(apiTokens.expiresAt),
          gt(apiTokens.expiresAt, now)
        )
      )
    );
  
  if (!apiToken) {
    return null;
  }
  
  // Get user email
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, apiToken.userId));
  
  if (!user) {
    return null;
  }
  
  // Update last used timestamp (fire and forget)
  db.update(apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(apiTokens.id, apiToken.id))
    .execute()
    .catch(() => {}); // Ignore errors
  
  return {
    tokenId: apiToken.id,
    userId: apiToken.userId,
    email: user.email,
    expiresAt: apiToken.expiresAt,
  };
}
