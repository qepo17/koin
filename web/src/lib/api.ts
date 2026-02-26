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
  list: (params?: { startDate?: string; endDate?: string; type?: string; categoryId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set("startDate", params.startDate);
    if (params?.endDate) searchParams.set("endDate", params.endDate);
    if (params?.type) searchParams.set("type", params.type);
    if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
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
  get: (from?: string, to?: string) => {
    const searchParams = new URLSearchParams();
    if (from) searchParams.set("from", from);
    if (to) searchParams.set("to", to);
    const query = searchParams.toString();
    return request<{ data: Summary }>(`/summary${query ? `?${query}` : ""}`);
  },
  
  trend: (params?: { period?: string; from?: string; to?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set("period", params.period);
    if (params?.from) searchParams.set("from", params.from);
    if (params?.to) searchParams.set("to", params.to);
    const query = searchParams.toString();
    return request<{ data: TrendData }>(`/summary/trend${query ? `?${query}` : ""}`);
  },
};

export interface TrendData {
  period: string;
  from: string;
  to: string;
  points: Array<{
    date: string;
    income: number;
    expenses: number;
    balance: number;
  }>;
}

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

// AI API
export const ai = {
  interpret: (prompt: string) =>
    request<{ data: AICommandPreview }>("/ai/command", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  getCommand: (id: string) =>
    request<{ data: AICommandStatus }>(`/ai/command/${id}`),

  confirm: (id: string) =>
    request<{ data: AICommandResult }>(`/ai/command/${id}/confirm`, {
      method: "POST",
    }),

  cancel: (id: string) =>
    request<{ data: { commandId: string; status: "cancelled" } }>(
      `/ai/command/${id}/cancel`,
      { method: "POST" }
    ),

  listCommands: (params?: { status?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return request<{ data: { commands: AICommandStatus[]; total: number } }>(
      `/ai/commands${query ? `?${query}` : ""}`
    );
  },
};

// Combined API object
export const api = {
  auth,
  transactions,
  categories,
  summary,
  settings,
  skill,
  ai,
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
  type: "income" | "expense" | "adjustment";
  amount: string;
  description: string | null;
  categoryId: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransaction {
  type: "income" | "expense" | "adjustment";
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
  adjustments: number;
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

// AI Types
export interface AIPreviewRecord {
  id: string;
  description: string | null;
  amount: string;
  date: string;
  categoryId: string | null;
  categoryName: string | null;
  type: "income" | "expense" | "adjustment";
}

export interface AICommandPreview {
  commandId: string;
  interpretation: string;
  preview: {
    matchCount: number;
    records: AIPreviewRecord[];
  };
  changes: {
    categoryId?: string;
    categoryName?: string;
    amount?: string;
    description?: string;
    type?: "income" | "expense" | "adjustment";
  };
  expiresIn: number;
}

export interface AICommandStatus {
  commandId: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  prompt: string;
  interpretation: string;
  preview: {
    matchCount: number;
    records: AIPreviewRecord[];
  };
  expiresIn: number;
  createdAt: string;
  executedAt: string | null;
}

export interface AICommandResult {
  commandId: string;
  status: "confirmed";
  result: {
    updatedCount: number;
    transactions: Array<{
      id: string;
      description: string | null;
      category: string | null;
    }>;
  };
}
