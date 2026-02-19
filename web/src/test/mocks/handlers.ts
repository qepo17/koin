import { http, HttpResponse } from "msw";

// Mock data
const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  currency: "USD",
  createdAt: new Date().toISOString(),
};

const mockSettings = {
  currency: "USD",
  name: "Test User",
};

const mockTransactions = [
  {
    id: "tx-1",
    userId: "user-1",
    type: "expense",
    amount: "25.50",
    description: "Coffee",
    categoryId: "cat-1",
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tx-2",
    userId: "user-1",
    type: "income",
    amount: "3000.00",
    description: "Salary",
    categoryId: null,
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockCategories = [
  {
    id: "cat-1",
    userId: "user-1",
    name: "Food & Dining",
    description: "Restaurants and groceries",
    color: "#ef4444",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockSummary = {
  income: 3000,
  expenses: 25.5,
  balance: 2974.5,
  byCategory: [
    { categoryId: "cat-1", categoryName: "Food & Dining", total: "25.50", count: 1 },
  ],
};

// Track auth state
let isAuthenticated = false;

export const handlers = [
  // Auth handlers
  http.post("/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string; name?: string };
    
    if (!body.email || !body.password) {
      return HttpResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    
    if (body.password.length < 8) {
      return HttpResponse.json(
        { error: [{ message: "Password must be at least 8 characters" }] },
        { status: 400 }
      );
    }
    
    isAuthenticated = true;
    return HttpResponse.json(
      { data: { user: { ...mockUser, email: body.email, name: body.name }, token: "mock-token" } },
      { status: 201 }
    );
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    
    if (body.email === "test@example.com" && body.password === "password123") {
      isAuthenticated = true;
      return HttpResponse.json({ data: { user: mockUser, token: "mock-token" } });
    }
    
    return HttpResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }),

  http.post("/api/auth/logout", () => {
    isAuthenticated = false;
    return HttpResponse.json({ data: { message: "Logged out" } });
  }),

  http.get("/api/auth/me", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: mockUser });
  }),

  // Transactions handlers
  http.get("/api/transactions", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: mockTransactions });
  }),

  http.post("/api/transactions", async ({ request }) => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const newTx = {
      id: `tx-${Date.now()}`,
      userId: "user-1",
      ...body,
      date: body.date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ data: newTx }, { status: 201 });
  }),

  http.delete("/api/transactions/:id", ({ params }) => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tx = mockTransactions.find((t) => t.id === params.id);
    if (!tx) {
      return HttpResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return HttpResponse.json({ data: tx });
  }),

  // Categories handlers
  http.get("/api/categories", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: mockCategories });
  }),

  http.post("/api/categories", async ({ request }) => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const newCat = {
      id: `cat-${Date.now()}`,
      userId: "user-1",
      color: "#6b7280",
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ data: newCat }, { status: 201 });
  }),

  // Summary handler
  http.get("/api/summary", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: mockSummary });
  }),

  // Settings handlers
  http.get("/api/settings", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: mockSettings });
  }),

  http.patch("/api/settings", async ({ request }) => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    
    if (body.currency !== undefined) {
      const currency = String(body.currency);
      if (currency.length !== 3) {
        return HttpResponse.json({ error: [{ message: "Currency must be 3 characters" }] }, { status: 400 });
      }
      mockSettings.currency = currency.toUpperCase();
    }
    if (body.name !== undefined) {
      mockSettings.name = body.name as string;
    }
    
    return HttpResponse.json({ data: mockSettings });
  }),

  // Skill handlers
  http.get("/api/skill/preview", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: { baseUrl: "http://localhost:3000/api" } });
  }),

  http.get("/api/skill/tokens", () => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return HttpResponse.json({ data: [] });
  }),

  http.post("/api/skill/tokens", async ({ request }) => {
    if (!isAuthenticated) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await request.json()) as { name: string; expiresIn: string };
    return HttpResponse.json({
      data: {
        id: `token-${Date.now()}`,
        name: body.name,
        tokenPrefix: "koin_xxxx",
        token: "koin_test_token_123",
        expiresAt: body.expiresIn === "never" ? null : new Date(Date.now() + 86400000).toISOString(),
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      },
    });
  }),
];

// Helper to reset auth state in tests
export function resetAuthState() {
  isAuthenticated = false;
}

export function setAuthState(authenticated: boolean) {
  isAuthenticated = authenticated;
}
