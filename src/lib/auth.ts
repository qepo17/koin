import { sign, verify } from "hono/jwt";
import type { Context } from "hono";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}
const jwtSecret = JWT_SECRET || "dev-secret-change-in-production";

// Short-lived access token: 15 minutes
const ACCESS_TOKEN_EXPIRES_IN = 60 * 15;
// Long-lived refresh token: 7 days
const REFRESH_TOKEN_EXPIRES_IN = 60 * 60 * 24 * 7;

/** @deprecated Use ACCESS_TOKEN_EXPIRES_IN instead */
const JWT_EXPIRES_IN = ACCESS_TOKEN_EXPIRES_IN;

export { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN };

export interface JWTPayload {
  sub: string; // user id
  email: string;
  exp: number;
  iat: number;
  type?: "access" | "refresh";
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
  return createAccessToken(userId, email);
}

export async function createAccessToken(userId: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    sub: userId,
    email,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRES_IN,
    type: "access",
  };
  return await sign(payload, jwtSecret, "HS256");
}

// Generate a cryptographically random refresh token string
export function generateRefreshToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Hash a refresh token for storage
export async function hashRefreshToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const payload = await verify(token, jwtSecret, "HS256");
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
    `token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${ACCESS_TOKEN_EXPIRES_IN}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
}

export function setRefreshCookie(c: Context, refreshToken: string) {
  // Use append to add multiple Set-Cookie headers
  c.header(
    "Set-Cookie",
    `refreshToken=${refreshToken}; HttpOnly; Path=/api/auth/refresh; SameSite=Strict; Max-Age=${REFRESH_TOKEN_EXPIRES_IN}${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
    { append: true }
  );
}

export function clearAuthCookie(c: Context) {
  c.header("Set-Cookie", "token=; HttpOnly; Path=/; Max-Age=0");
}

export function clearRefreshCookie(c: Context) {
  c.header(
    "Set-Cookie",
    "refreshToken=; HttpOnly; Path=/api/auth/refresh; Max-Age=0",
    { append: true }
  );
}

export function getTokenFromRequest(c: Context): string | null {
  // Check cookie first
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return match[1];
  }

  // Fallback to Authorization header
  const auth = c.req.header("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }

  return null;
}

export function getRefreshTokenFromRequest(c: Context): string | null {
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)refreshToken=([^;]+)/);
    if (match) return match[1];
  }

  // Also accept from request body (for non-cookie clients)
  return null;
}

// ============================================
// API Token functions (for integrations)
// ============================================

const API_TOKEN_PREFIX = "koin_";

// Generate a random API token
export function generateApiToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${API_TOKEN_PREFIX}${base64}`;
}

// Hash an API token for storage
export async function hashApiToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Get the prefix for display (e.g., "koin_abc1...")
export function getApiTokenPrefix(token: string): string {
  return token.slice(0, 12) + "...";
}

// Check if a token looks like an API token (vs JWT)
export function isApiToken(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX);
}
