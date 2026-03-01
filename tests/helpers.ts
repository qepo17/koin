import { app } from "../src/index";
import { getDb } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword, createToken } from "../src/lib/auth";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
};

export async function request(path: string, options: RequestOptions = {}) {
  const { method = "GET", body, headers = {}, token } = options;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await app.fetch(
    new Request(`http://localhost${path}`, requestInit)
  );

  const data = await response.json();
  return { status: response.status, data, response };
}

// Create an API client with optional auth token
export function createApi(token?: string) {
  return {
    get: (path: string) => request(path, { method: "GET", token }),
    post: (path: string, body: unknown) => request(path, { method: "POST", body, token }),
    put: (path: string, body: unknown) => request(path, { method: "PUT", body, token }),
    patch: (path: string, body: unknown) => request(path, { method: "PATCH", body, token }),
    delete: (path: string) => request(path, { method: "DELETE", token }),
  };
}

// Default unauthenticated API
export const api = createApi();

// Create a test API client that tracks cookies and exposes baseUrl
export type TestApi = ReturnType<typeof createTestApi>;

export function createTestApi() {
  let authToken: string | null = null;
  const baseUrl = "http://localhost:3000";

  const makeRequest = async (path: string, options: RequestOptions = {}) => {
    const result = await request(path, { ...options, token: authToken || undefined });
    
    // Extract token from response if it's an auth response
    if (result.data?.data?.token) {
      authToken = result.data.data.token;
    }
    
    return result;
  };

  return {
    baseUrl,
    get: (path: string) => makeRequest(path, { method: "GET" }),
    post: (path: string, body: unknown) => makeRequest(path, { method: "POST", body }),
    patch: (path: string, body: unknown) => makeRequest(path, { method: "PATCH", body }),
    delete: (path: string) => makeRequest(path, { method: "DELETE" }),
    getToken: () => authToken,
    setToken: (token: string) => { authToken = token; },
    clearToken: () => { authToken = null; },
    getCookies: () => authToken ? `token=${authToken}` : "",
  };
}

// Test user helpers
let testUserCounter = 0;

export function generateTestUser() {
  testUserCounter++;
  return {
    email: `test${testUserCounter}@example.com`,
    password: "password123",
    name: `Test User ${testUserCounter}`,
  };
}

export async function createTestUser(userData?: { email?: string; password?: string; name?: string }) {
  const user = { ...generateTestUser(), ...userData };
  const result = await api.post("/api/auth/register", user);
  return {
    user,
    token: result.data?.data?.token as string,
    response: result,
  };
}

// Create a user directly in the DB, bypassing the register endpoint.
// Use this when you need additional users after the first (since registration is closed after setup).
export async function createTestUserDirect(userData?: { email?: string; password?: string; name?: string }) {
  const defaults = generateTestUser();
  const user = { ...defaults, ...userData };
  const passwordHash = await hashPassword(user.password);
  const db = getDb();
  const [inserted] = await db
    .insert(users)
    .values({ email: user.email.toLowerCase(), passwordHash, name: user.name })
    .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });
  const token = await createToken(inserted.id, inserted.email);
  return { user, token, dbUser: inserted };
}

export async function loginTestUser(email: string, password: string) {
  const result = await api.post("/api/auth/login", { email, password });
  return {
    token: result.data?.data?.token as string,
    response: result,
  };
}
