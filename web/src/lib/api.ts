const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api`;

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
  setupStatus: () =>
    request<{ data: { needsSetup: boolean } }>("/auth/setup-status"),

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

// Settings API
export const settings = {
  get: () => request<{ data: Settings }>("/settings"),
  update: (body: Partial<Settings>) =>
    request<{ data: Settings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};

// Skill API
export const skill = {
  preview: async () => {
    try {
      const data = await request<{ data: SkillPreview }>("/skill/preview");
      return { ok: true as const, data: data.data };
    } catch (error) {
      return { ok: false as const, error };
    }
  },
  listTokens: () => request<{ data: ApiToken[] }>("/skill/tokens"),
  createToken: (body: { name: string; expiresIn: string }) =>
    request<{ data: ApiToken & { token: string } }>("/skill/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  revokeToken: (id: string) =>
    request<{ data: { message: string } }>(`/skill/tokens/${id}`, {
      method: "DELETE",
    }),
};

// Combined API object
export const api = {
  auth,
  transactions,
  categories,
  summary,
  settings,
  skill,
};

// Types
export interface User {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  createdAt: string;
}

export interface Settings {
  currency: string;
  name: string | null;
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

export interface SkillPreview {
  baseUrl: string;
}

export interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}
