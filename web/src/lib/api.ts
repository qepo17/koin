const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown
  ) {
    super(`API Error: ${status}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Include cookies for auth
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data);
  }

  return data;
}

// Auth API
export const auth = {
  register: (body: { email: string; password: string; name?: string }) =>
    request<{ data: { user: User; token: string } }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<{ data: { user: User; token: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<{ data: { message: string } }>("/auth/logout", {
      method: "POST",
    }),

  me: () => request<{ data: User }>("/auth/me"),
};

// Transactions API
export const transactions = {
  list: (params?: { startDate?: string; endDate?: string; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.type) searchParams.set("type", params.type);
    const query = searchParams.toString();
    return request<{ data: Transaction[] }>(
      `/transactions${query ? `?${query}` : ""}`
    );
  },

  get: (id: string) => request<{ data: Transaction }>(`/transactions/${id}`),

  create: (body: CreateTransaction) =>
    request<{ data: Transaction }>("/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<CreateTransaction>) =>
    request<{ data: Transaction }>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ data: Transaction }>(`/transactions/${id}`, {
      method: "DELETE",
    }),
};

// Categories API
export const categories = {
  list: () => request<{ data: Category[] }>("/categories"),

  get: (id: string) => request<{ data: Category }>(`/categories/${id}`),

  create: (body: CreateCategory) =>
    request<{ data: Category }>("/categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<CreateCategory>) =>
    request<{ data: Category }>(`/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ data: Category }>(`/categories/${id}`, {
      method: "DELETE",
    }),
};

// Summary API
export const summary = {
  get: (params?: { startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    const query = searchParams.toString();
    return request<{ data: Summary }>(`/summary${query ? `?${query}` : ""}`);
  },
};

// Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "income" | "expense";
  amount: string;
  description: string | null;
  categoryId: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransaction {
  type: "income" | "expense";
  amount: string;
  description?: string;
  categoryId?: string;
  date?: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategory {
  name: string;
  description?: string;
  color?: string;
}

export interface Summary {
  income: number;
  expenses: number;
  balance: number;
  byCategory: {
    categoryId: string | null;
    categoryName: string | null;
    total: string;
    count: number;
  }[];
}
