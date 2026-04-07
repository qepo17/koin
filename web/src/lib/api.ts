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

// Token refresh state to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function refreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = attemptTokenRefresh().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  _isRetry = false
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    credentials: "include", // Include cookies for auth
  });

  // If we get a 401 and this isn't already a retry, attempt token refresh
  if (response.status === 401 && !_isRetry && !path.startsWith("/auth/")) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry the original request
      return request<T>(path, options, true);
    }
  }

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
  getPrivacy: () => request<{ data: PrivacyStatus }>("/settings/privacy"),
  setPrivacy: (enabled: boolean) =>
    request<{ data: PrivacyStatus }>("/settings/privacy", {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
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

// Debt Accounts API
export const debtAccounts = {
  list: (params?: { status?: string; type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.type) searchParams.set("type", params.type);
    const query = searchParams.toString();
    return request<{ data: DebtAccountWithTotals[] }>(
      `/debt-accounts${query ? `?${query}` : ""}`
    );
  },

  get: (id: string) =>
    request<{ data: DebtAccountDetail }>(`/debt-accounts/${id}`),

  create: (body: CreateDebtAccount) =>
    request<{ data: DebtAccount }>("/debt-accounts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<CreateDebtAccount>) =>
    request<{ data: DebtAccount }>(`/debt-accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  close: (id: string) =>
    request<{ data: DebtAccount }>(`/debt-accounts/${id}`, {
      method: "DELETE",
    }),
};

// Debts API
export const debts = {
  list: (accountId: string, params?: { status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    const query = searchParams.toString();
    return request<{ data: Debt[] }>(
      `/debt-accounts/${accountId}/debts${query ? `?${query}` : ""}`
    );
  },

  create: (accountId: string, body: CreateDebt) =>
    request<{ data: Debt }>(`/debt-accounts/${accountId}/debts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (accountId: string, id: string, body: Partial<CreateDebt>) =>
    request<{ data: Debt }>(`/debt-accounts/${accountId}/debts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  cancel: (accountId: string, id: string) =>
    request<{ data: Debt }>(`/debt-accounts/${accountId}/debts/${id}`, {
      method: "DELETE",
    }),
};

// Debt Payments API
export const debtPayments = {
  list: (accountId: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());
    const query = searchParams.toString();
    return request<{ data: DebtPaymentWithAllocations[] }>(
      `/debt-accounts/${accountId}/payments${query ? `?${query}` : ""}`
    );
  },
};

// Debt Summary API
export const debtSummary = {
  get: () => request<{ data: DebtSummaryData }>("/debts/summary"),

  checkBilling: (date: string) =>
    request<{ data: BillingResult[] }>("/debts/check-billing", {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
};

// Subscriptions API
export const subscriptions = {
  list: (params?: { status?: string; billingCycle?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.billingCycle) query.append("billingCycle", params.billingCycle);
    const queryString = query.toString() ? `?${query.toString()}` : "";
    return request<{ data: Subscription[] }>(`/subscriptions${queryString}`);
  },

  get: (id: string) =>
    request<{ data: Subscription }>(`/subscriptions/${id}`),

  create: (body: CreateSubscriptionData) =>
    request<{ data: Subscription }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: UpdateSubscriptionData) =>
    request<{ data: Subscription }>(`/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ data: { message: string } }>(`/subscriptions/${id}`, {
      method: "DELETE",
    }),

  pause: (id: string) =>
    request<{ data: Subscription }>(`/subscriptions/${id}/pause`, {
      method: "POST",
    }),

  resume: (id: string) =>
    request<{ data: Subscription }>(`/subscriptions/${id}/resume`, {
      method: "POST",
    }),

  summary: () =>
    request<{ data: SubscriptionSummary }>("/subscriptions/summary"),

  checkBilling: (date?: string) =>
    request<{ data: BillingCheckResult }>("/subscriptions/check-billing", {
      method: "POST",
      body: JSON.stringify({ date }),
    }),
};

// Rules API
export const rules = {
  list: () => request<{ data: Rule[] }>("/rules"),

  get: (id: string) => request<{ data: Rule }>(`/rules/${id}`),

  create: (body: CreateRule) =>
    request<{ data: Rule }>("/rules", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  update: (id: string, body: UpdateRule) =>
    request<{ data: Rule }>(`/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  delete: (id: string) =>
    request<{ data: Rule }>(`/rules/${id}`, {
      method: "DELETE",
    }),

  reorder: (ruleIds: string[]) =>
    request<{ data: { message: string } }>("/rules/reorder", {
      method: "POST",
      body: JSON.stringify({ ruleIds }),
    }),

  apply: (id: string) =>
    request<{ data: { categorized: number } }>(`/rules/${id}/apply`, {
      method: "POST",
    }),

  test: (body: { ruleId?: string; conditions?: RuleCondition[]; transaction: { description: string; amount: number } }) =>
    request<{ data: { match: boolean } }>("/rules/test", {
      method: "POST",
      body: JSON.stringify(body),
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
  ai,
  debtAccounts,
  debts,
  debtPayments,
  debtSummary,
  subscriptions,
  rules,
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
  privacyMode: boolean;
}

export interface PrivacyStatus {
  enabled: boolean;
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

// Debt Types
export interface DebtAccount {
  id: string;
  userId: string;
  name: string;
  type: "credit_card" | "loan" | "other";
  creditor: string | null;
  creditLimit: string | null;
  billingDay: number;
  categoryId: string | null;
  autoTrack: boolean;
  status: "active" | "closed";
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DebtAccountWithTotals extends DebtAccount {
  totalDebt: string;
  totalPaid: string;
  totalRemaining: string;
  monthlyCommitment: string;
  debtsCount: number;
}

export interface DebtAccountDetail extends DebtAccount {
  debts: Debt[];
  recentPayments: DebtPaymentWithAllocations[];
}

export interface CreateDebtAccount {
  name: string;
  type: "credit_card" | "loan" | "other";
  creditor?: string;
  creditLimit?: string;
  billingDay: number;
  categoryId?: string;
  autoTrack?: boolean;
  description?: string;
}

export interface Debt {
  id: string;
  accountId: string;
  userId: string;
  name: string;
  type: "installment" | "revolving" | "loan" | "other";
  totalAmount: string;
  monthlyAmount: string;
  interestRate: string | null;
  installmentMonths: number | null;
  installmentStart: string | null;
  description: string | null;
  status: "active" | "paid_off" | "cancelled";
  paidOffAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDebt {
  name: string;
  type: "installment" | "revolving" | "loan" | "other";
  totalAmount: string;
  monthlyAmount: string;
  interestRate?: string;
  installmentMonths?: number;
  installmentStart?: string;
  description?: string;
}

export interface DebtPayment {
  id: string;
  accountId: string;
  userId: string;
  totalAmount: string;
  note: string | null;
  transactionId: string | null;
  paidAt: string;
  createdAt: string;
}

export interface DebtPaymentAllocation {
  id: string;
  paymentId: string;
  debtId: string;
  amount: string;
  principal: string | null;
  interest: string | null;
}

export interface DebtPaymentWithAllocations extends DebtPayment {
  allocations: DebtPaymentAllocation[];
}

export interface DebtSummaryData {
  totalDebt: string;
  totalPaid: string;
  totalRemaining: string;
  monthlyCommitment: string;
  activeAccounts: number;
  activeDebts: number;
  upcomingThisMonth: Array<{
    accountId: string;
    accountName: string;
    totalDue: string;
    billingDay: number;
    debts: Array<{ name: string; amount: string }>;
  }>;
  byAccount: Array<{
    accountId: string;
    accountName: string;
    creditor: string | null;
    type: string;
    totalRemaining: string;
    monthlyCommitment: string;
    activeDebts: number;
  }>;
  byType: Record<string, {
    accounts: number;
    totalRemaining: string;
    monthlyTotal: string;
  }>;
}

export interface BillingResult {
  accountId: string;
  accountName: string;
  transactionId: string;
  amount: string;
}

// Subscription Types
export interface Subscription {
  id: string;
  name: string;
  amount: string;
  currency: string;
  billingCycle: "weekly" | "monthly" | "quarterly" | "yearly";
  billingDay: number;
  categoryId: string | null;
  categoryName?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: "active" | "paused" | "cancelled";
  url?: string;
  autoTrack: boolean;
  nextBillingDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriptionData {
  name: string;
  amount: string;
  billingCycle: "weekly" | "monthly" | "quarterly" | "yearly";
  billingDay?: number;
  categoryId?: string;
  description?: string;
  startDate?: string;
  url?: string;
  autoTrack?: boolean;
}

export interface UpdateSubscriptionData {
  name?: string;
  amount?: string;
  billingCycle?: "weekly" | "monthly" | "quarterly" | "yearly";
  billingDay?: number;
  categoryId?: string;
  description?: string;
  url?: string;
  autoTrack?: boolean;
}

export interface SubscriptionSummary {
  monthlyTotal: string;
  yearlyTotal: string;
  activeCount: number;
  upcomingThisWeek: Array<{
    id: string;
    name: string;
    amount: string;
    nextBillingDate: string;
  }>;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    monthlyTotal: string;
    count: number;
  }>;
  byCycle: {
    weekly: string;
    monthly: string;
    quarterly: string;
    yearly: string;
  };
}

export interface BillingCheckResult {
  processed: number;
  transactions: Array<{
    subscriptionId: string;
    subscriptionName: string;
    transactionId: string;
    amount: string;
  }>;
  skipped: Array<{
    subscriptionId: string;
    subscriptionName: string;
    reason: string;
  }>;
}

// Rule Types
export interface DescriptionCondition {
  field: "description";
  operator: "contains" | "startsWith" | "endsWith" | "exact";
  value: string;
  negate?: boolean;
  caseSensitive?: boolean;
}

export interface AmountCondition {
  field: "amount";
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "between";
  value: number;
  value2?: number;
}

export type RuleCondition = DescriptionCondition | AmountCondition;

export interface Rule {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  conditions: RuleCondition[];
  priority: number;
  enabled: boolean;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRule {
  name: string;
  categoryId: string;
  conditions: RuleCondition[];
  priority?: number;
  enabled?: boolean;
}

export interface UpdateRule {
  name?: string;
  categoryId?: string;
  conditions?: RuleCondition[];
  priority?: number;
  enabled?: boolean;
}
