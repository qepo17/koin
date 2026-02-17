import { sign, verify } from "hono/jwt";
import type { Context } from "hono";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days in seconds

export interface JWTPayload {
  sub: string; // user id
  email: string;
  exp: number;
  iat: number;
  [key: string]: unknown; // Allow additional properties for Hono JWT compatibility
}

export async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

export async function createToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: userId,
    email,
    iat: now,
    exp: now + JWT_EXPIRES_IN,
  };
  return await sign(payload, JWT_SECRET, "HS256");
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, JWT_SECRET, "HS256");
    if (payload && typeof payload.sub === "string" && typeof payload.email === "string") {
      return payload as JWTPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAuthCookie(c: Context, token: string) {
  c.header(
    "Set-Cookie",
    `token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${JWT_EXPIRES_IN}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
}

export function clearAuthCookie(c: Context) {
  c.header("Set-Cookie", "token=; HttpOnly; Path=/; Max-Age=0");
}

export function getTokenFromRequest(c: Context): string | null {
  // Check cookie first
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  
  // Fallback to Authorization header
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  
  return null;
}
