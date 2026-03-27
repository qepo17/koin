import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  debtAccounts,
  debts,
  debtSummary,
  categories as categoriesApi,
  type DebtAccountWithTotals,
  type DebtAccount,
  type Debt,
  type CreateDebtAccount,
  type CreateDebt,
  type Category,
} from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency } from "../lib/currency";

const ACCOUNT_TYPES = [
  { value: "credit_card", label: "Credit Card" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
] as const;

const DEBT_TYPES = [
  { value: "installment", label: "Installment" },
  { value: "revolving", label: "Revolving" },
  { value: "loan", label: "Loan" },
  { value: "other", label: "Other" },
] as const;

export function DebtsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? "USD";
  const queryClient = useQueryClient();

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DebtAccountWithTotals | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const { data: summaryData } = useQuery({
    queryKey: ["debt-summary"],
    queryFn: () => debtSummary.get(),
  });

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ["debt-accounts"],
    queryFn: () => debtAccounts.list(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });

  const { data: debtsData } = useQuery({
    queryKey: ["debts", selectedAccountId],
    queryFn: () => debts.list(selectedAccountId!),
    enabled: !!selectedAccountId,
  });

  const closeAccountMutation = useMutation({
    mutationFn: (id: string) => debtAccounts.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-summary"] });
      setSelectedAccountId(null);
    },
  });

  const cancelDebtMutation = useMutation({
    mutationFn: ({ accountId, debtId }: { accountId: string; debtId: string }) =>
      debts.cancel(accountId, debtId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-summary"] });
    },
  });

  const accounts = accountsData?.data ?? [];
  const accountDebts = debtsData?.data ?? [];
  const cats = categoriesData?.data ?? [];
  const summary = summaryData?.data;

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Debts</h1>
        <button
          onClick={() => {
            setEditingAccount(null);
            setShowAccountForm(true);
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700"
        >
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Debt"
            value={formatCurrency(summary.totalDebt, currency)}
            color="text-red-600"
          />
          <SummaryCard
            label="Total Paid"
            value={formatCurrency(summary.totalPaid, currency)}
            color="text-green-600"
          />
          <SummaryCard
            label="Remaining"
            value={formatCurrency(summary.totalRemaining, currency)}
            color="text-orange-600"
          />
          <SummaryCard
            label="Monthly Commitment"
            value={formatCurrency(summary.monthlyCommitment, currency)}
            color="text-blue-600"
          />
        </div>
      )}

      {/* Upcoming This Month */}
      {summary && summary.upcomingThisMonth.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-medium text-amber-800 mb-2">Upcoming This Month</h3>
          <div className="space-y-2">
            {summary.upcomingThisMonth.map((item) => (
              <div key={item.accountId} className="flex items-center justify-between text-sm">
                <span className="text-amber-900">
                  {item.accountName} (Day {item.billingDay})
                </span>
                <span className="font-medium text-amber-900">
                  {formatCurrency(item.totalDue, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-panel layout: accounts list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accounts List */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Accounts</h2>
          {isLoading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              No debt accounts yet.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`w-full text-left bg-white rounded-lg shadow p-4 hover:ring-2 hover:ring-emerald-300 transition ${
                    selectedAccountId === account.id ? "ring-2 ring-emerald-500" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{account.name}</span>
                    <AccountTypeBadge type={account.type} />
                  </div>
                  {account.creditor && (
                    <p className="text-xs text-gray-500 mb-2">{account.creditor}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Remaining</span>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(account.totalRemaining, currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Monthly</span>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(account.monthlyCommitment, currency)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span>{account.debtsCount} debt{account.debtsCount !== 1 ? "s" : ""}</span>
                    <span>Billing day {account.billingDay}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account Detail */}
        <div className="lg:col-span-2">
          {selectedAccount ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedAccount.name}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowDebtForm(true);
                      setEditingDebt(null);
                    }}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-emerald-700"
                  >
                    Add Debt
                  </button>
                  <button
                    onClick={() => {
                      setEditingAccount(selectedAccount);
                      setShowAccountForm(true);
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Close this account? It must have no active debts.")) {
                        closeAccountMutation.mutate(selectedAccount.id);
                      }
                    }}
                    className="px-3 py-1.5 border border-red-300 rounded-md text-sm text-red-600 hover:bg-red-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Account info */}
              <div className="bg-white rounded-lg shadow p-4 mb-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Type</span>
                    <p className="font-medium">{selectedAccount.type.replace("_", " ")}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Creditor</span>
                    <p className="font-medium">{selectedAccount.creditor || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Credit Limit</span>
                    <p className="font-medium">
                      {selectedAccount.creditLimit
                        ? formatCurrency(selectedAccount.creditLimit, currency)
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Auto Track</span>
                    <p className="font-medium">{selectedAccount.autoTrack ? "On" : "Off"}</p>
                  </div>
                </div>
              </div>

              {/* Close mutation error */}
              {closeAccountMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                  {(closeAccountMutation.error as any)?.data?.error ||
                    "Cannot close account with active debts."}
                </div>
              )}

              {/* Debts list */}
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Debts</h3>
              {accountDebts.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-4 text-center text-gray-500 text-sm">
                  No debts yet. Click "Add Debt" to create one.
                </div>
              ) : (
                <div className="space-y-3">
                  {accountDebts.map((debt) => (
                    <div
                      key={debt.id}
                      className={`bg-white rounded-lg shadow p-4 ${
                        debt.status !== "active" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{debt.name}</span>
                          <DebtTypeBadge type={debt.type} />
                          {debt.status !== "active" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              {debt.status}
                            </span>
                          )}
                        </div>
                        {debt.status === "active" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingDebt(debt);
                                setShowDebtForm(true);
                              }}
                              className="text-sm text-gray-400 hover:text-gray-600"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                if (confirm("Cancel this debt?")) {
                                  cancelDebtMutation.mutate({
                                    accountId: selectedAccount.id,
                                    debtId: debt.id,
                                  });
                                }
                              }}
                              className="text-sm text-gray-400 hover:text-red-600"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Total</span>
                          <p className="font-medium">{formatCurrency(debt.totalAmount, currency)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Monthly</span>
                          <p className="font-medium">{formatCurrency(debt.monthlyAmount, currency)}</p>
                        </div>
                        {debt.interestRate && (
                          <div>
                            <span className="text-gray-500">Interest</span>
                            <p className="font-medium">{debt.interestRate}%/yr</p>
                          </div>
                        )}
                        {debt.installmentMonths && (
                          <div>
                            <span className="text-gray-500">Installments</span>
                            <p className="font-medium">{debt.installmentMonths} months</p>
                          </div>
                        )}
                      </div>
                      {debt.description && (
                        <p className="text-xs text-gray-500 mt-2">{debt.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select an account to view its debts.
            </div>
          )}
        </div>
      </div>

      {/* Account Form Modal */}
      {showAccountForm && (
        <AccountForm
          editingAccount={editingAccount}
          categories={cats}
          onClose={() => {
            setShowAccountForm(false);
            setEditingAccount(null);
          }}
        />
      )}

      {/* Debt Form Modal */}
      {showDebtForm && selectedAccountId && (
        <DebtForm
          accountId={selectedAccountId}
          editingDebt={editingDebt}
          onClose={() => {
            setShowDebtForm(false);
            setEditingDebt(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function AccountTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    credit_card: "bg-purple-100 text-purple-700",
    loan: "bg-blue-100 text-blue-700",
    other: "bg-gray-100 text-gray-700",
  };
  const labels: Record<string, string> = {
    credit_card: "CC",
    loan: "Loan",
    other: "Other",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[type] || colors.other}`}>
      {labels[type] || type}
    </span>
  );
}

function DebtTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    installment: "bg-emerald-100 text-emerald-700",
    revolving: "bg-orange-100 text-orange-700",
    loan: "bg-blue-100 text-blue-700",
    other: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[type] || colors.other}`}>
      {type}
    </span>
  );
}

function AccountForm({
  editingAccount,
  categories,
  onClose,
}: {
  editingAccount: DebtAccountWithTotals | null;
  categories: Category[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editingAccount?.name ?? "");
  const [type, setType] = useState<CreateDebtAccount["type"]>(
    editingAccount?.type ?? "credit_card"
  );
  const [creditor, setCreditor] = useState(editingAccount?.creditor ?? "");
  const [creditLimit, setCreditLimit] = useState(editingAccount?.creditLimit ?? "");
  const [billingDay, setBillingDay] = useState(
    editingAccount?.billingDay?.toString() ?? "1"
  );
  const [categoryId, setCategoryId] = useState(editingAccount?.categoryId ?? "");
  const [autoTrack, setAutoTrack] = useState(editingAccount?.autoTrack ?? true);
  const [description, setDescription] = useState(editingAccount?.description ?? "");

  const createMutation = useMutation({
    mutationFn: (data: CreateDebtAccount) => debtAccounts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-summary"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDebtAccount> }) =>
      debtAccounts.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-summary"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateDebtAccount = {
      name,
      type,
      billingDay: parseInt(billingDay),
      creditor: creditor || undefined,
      creditLimit: creditLimit || undefined,
      categoryId: categoryId || undefined,
      autoTrack,
      description: description || undefined,
    };

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {editingAccount ? "Edit Account" : "Add Debt Account"}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
            {(error as any)?.data?.error || "Something went wrong"}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., BRI Credit Card"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CreateDebtAccount["type"])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Creditor</label>
              <input
                type="text"
                value={creditor}
                onChange={(e) => setCreditor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., BRI"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Day</label>
              <input
                type="number"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Linked Category (for auto-payment)
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoTrack"
              checked={autoTrack}
              onChange={(e) => setAutoTrack(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="autoTrack" className="text-sm text-gray-700">
              Auto-track payments from linked category
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DebtForm({
  accountId,
  editingDebt,
  onClose,
}: {
  accountId: string;
  editingDebt: Debt | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editingDebt?.name ?? "");
  const [type, setType] = useState<CreateDebt["type"]>(editingDebt?.type ?? "installment");
  const [totalAmount, setTotalAmount] = useState(editingDebt?.totalAmount ?? "");
  const [monthlyAmount, setMonthlyAmount] = useState(editingDebt?.monthlyAmount ?? "");
  const [interestRate, setInterestRate] = useState(editingDebt?.interestRate ?? "");
  const [installmentMonths, setInstallmentMonths] = useState(
    editingDebt?.installmentMonths?.toString() ?? ""
  );
  const [installmentStart, setInstallmentStart] = useState(
    editingDebt?.installmentStart ? editingDebt.installmentStart.slice(0, 10) : ""
  );
  const [description, setDescription] = useState(editingDebt?.description ?? "");

  const createMutation = useMutation({
    mutationFn: (data: CreateDebt) => debts.create(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-summary"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateDebt> }) =>
      debts.update(accountId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["debt-summary"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateDebt = {
      name,
      type,
      totalAmount,
      monthlyAmount,
      interestRate: interestRate || undefined,
      installmentMonths: installmentMonths ? parseInt(installmentMonths) : undefined,
      installmentStart: installmentStart
        ? new Date(installmentStart).toISOString()
        : undefined,
      description: description || undefined,
    };

    if (editingDebt) {
      updateMutation.mutate({ id: editingDebt.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {editingDebt ? "Edit Debt" : "Add Debt"}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
            {(error as any)?.data?.error || "Something went wrong"}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., iPhone 16 Pro"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CreateDebt["type"])}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {DEBT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Interest Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Installment Months
              </label>
              <input
                type="number"
                min="1"
                value={installmentMonths}
                onChange={(e) => setInstallmentMonths(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Installment Start Date
            </label>
            <input
              type="date"
              value={installmentStart}
              onChange={(e) => setInstallmentStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., 12x 0% installment"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
