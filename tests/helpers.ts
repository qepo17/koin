import { app } from "../src/index";

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
    patch: (path: string, body: unknown) => request(path, { method: "PATCH", body, token }),
    delete: (path: string) => request(path, { method: "DELETE", token }),
  };
}

// Default unauthenticated API
export const api = createApi();

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

export async function loginTestUser(email: string, password: string) {
  const result = await api.post("/api/auth/login", { email, password });
  return {
    token: result.data?.data?.token as string,
    response: result,
  };
}
