import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { summary, transactions } from "../lib/api";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, formatCurrencyWithSign, getCurrencySymbol } from "../lib/currency";

// Helper to get date range for this month and last month
function getMonthRanges() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  return {
    thisMonth: {
      from: formatDate(thisMonthStart),
      to: formatDate(now),
    },
    lastMonth: {
      from: formatDate(lastMonthStart),
      to: formatDate(lastMonthEnd),
    },
  };
}

export function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.currency || "USD";
  const queryClient = useQueryClient();
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const ranges = getMonthRanges();

  // Current month summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary", "thisMonth", ranges.thisMonth],
    queryFn: () => summary.get(ranges.thisMonth.from, ranges.thisMonth.to),
  });

  // Previous month summary for comparison
  const { data: prevSummaryData } = useQuery({
    queryKey: ["summary", "lastMonth", ranges.lastMonth],
    queryFn: () => summary.get(ranges.lastMonth.from, ranges.lastMonth.to),
  });

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery(
    {
      queryKey: ["transactions", "recent"],
      queryFn: () => transactions.list(),
    }
  );

  const stats = summaryData?.data;
  const prevStats = prevSummaryData?.data;
  const recent = recentTransactions?.data?.slice(0, 5) ?? [];

  const handleBalanceAdjusted = () => {
    queryClient.invalidateQueries({ queryKey: ["summary"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className={`grid grid-cols-1 gap-6 mb-8 ${stats?.adjustments ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <StatCard
          title="Income"
          value={stats?.income ?? 0}
          currency={currency}
          isLoading={summaryLoading}
          color="green"
          previousValue={prevStats?.income}
        />
        <StatCard
          title="Expenses"
          value={stats?.expenses ?? 0}
          currency={currency}
          isLoading={summaryLoading}
          color="red"
          previousValue={prevStats?.expenses}
        />
        {stats?.adjustments !== undefined && stats.adjustments !== 0 && (
          <StatCard
            title="Adjustments"
            value={stats.adjustments}
            currency={currency}
            isLoading={summaryLoading}
            color="purple"
            showSign
          />
        )}
        <StatCard
          title="Balance"
          value={stats?.balance ?? 0}
          currency={currency}
          isLoading={summaryLoading}
          color="blue"
          onClick={() => setShowBalanceModal(true)}
          editable
        />
      </div>

      {/* Balance Adjustment Modal */}
      {showBalanceModal && (
        <BalanceAdjustmentModal
          currentBalance={stats?.balance ?? 0}
          currency={currency}
          onClose={() => setShowBalanceModal(false)}
          onSuccess={handleBalanceAdjusted}
        />
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Transactions
          </h2>
          <Link
            to="/transactions"
            className="text-sm text-emerald-600 hover:underline"
          >
            View all
          </Link>
        </div>

        {transactionsLoading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : recent.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transactions yet.{" "}
            <Link to="/transactions" className="text-emerald-600 hover:underline">
              Add one
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {recent.map((tx) => (
              <li
                key={tx.id}
                className="px-6 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {tx.description || "No description"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(tx.date).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    tx.type === "income"
                      ? "text-green-600"
                      : tx.type === "expense"
                      ? "text-red-600"
                      : "text-purple-600"
                  }`}
                >
                  {formatCurrencyWithSign(tx.amount, currency, tx.type)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Spending by Category */}
      {stats?.byCategory && stats.byCategory.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Spending by Category
            </h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {stats.byCategory.map((cat, i) => (
              <li
                key={cat.categoryId || i}
                className="px-6 py-4 flex items-center justify-between"
              >
                <span className="text-gray-900">
                  {cat.categoryName || "Uncategorized"}
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(cat.total, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  currency,
  isLoading,
  color,
  showSign = false,
  onClick,
  editable = false,
  previousValue,
}: {
  title: string;
  value: number;
  currency: string;
  isLoading: boolean;
  color: "green" | "red" | "blue" | "purple";
  showSign?: boolean;
  onClick?: () => void;
  editable?: boolean;
  previousValue?: number;
}) {
  const colorClasses = {
    green: "text-green-600",
    red: "text-red-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  };

  const formattedValue = showSign
    ? `${value >= 0 ? "+" : ""}${formatCurrency(value, currency)}`
    : formatCurrency(value, currency);

  // Calculate percentage change
  const change = previousValue !== undefined && previousValue !== 0
    ? ((value - previousValue) / Math.abs(previousValue)) * 100
    : previousValue === 0 && value !== 0
    ? 100 // Went from 0 to something
    : null;

  return (
    <div
      className={`bg-white rounded-lg shadow p-6 ${
        editable ? "cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all" : ""
      }`}
      onClick={onClick}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      onKeyDown={editable ? (e) => e.key === "Enter" && onClick?.() : undefined}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {editable && (
          <span className="text-xs text-gray-400">Click to adjust</span>
        )}
      </div>
      {isLoading ? (
        <div className="mt-2 h-8 bg-gray-200 rounded animate-pulse" />
      ) : (
        <>
          <p className={`mt-2 text-3xl font-bold ${colorClasses[color]}`}>
            {formattedValue}
          </p>
          {change !== null && (
            <ChangeIndicator change={change} label="vs last month" />
          )}
        </>
      )}
    </div>
  );
}

function ChangeIndicator({ change, label }: { change: number; label: string }) {
  const isPositive = change >= 0;
  const absChange = Math.abs(change);
  
  // For very small changes, show as no change
  if (absChange < 0.1) {
    return (
      <p className="mt-1 text-xs text-gray-400">
        No change {label}
      </p>
    );
  }

  return (
    <p className={`mt-1 text-xs flex items-center gap-1 ${
      isPositive ? "text-green-600" : "text-red-600"
    }`}>
      {isPositive ? (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      )}
      <span>{absChange.toFixed(1)}% {label}</span>
    </p>
  );
}

function BalanceAdjustmentModal({
  currentBalance,
  currency,
  onClose,
  onSuccess,
}: {
  currentBalance: number;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [targetBalance, setTargetBalance] = useState(currentBalance.toString());
  const symbol = getCurrencySymbol(currency);

  const createAdjustment = useMutation({
    mutationFn: (amount: string) =>
      transactions.create({
        type: "adjustment",
        amount,
        description: "Balance adjustment",
        date: new Date().toISOString(),
      }),
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetBalance);
    if (isNaN(target)) return;

    const adjustmentAmount = target - currentBalance;
    if (adjustmentAmount === 0) {
      onClose();
      return;
    }

    createAdjustment.mutate(adjustmentAmount.toFixed(2));
  };

  const target = parseFloat(targetBalance) || 0;
  const adjustmentAmount = target - currentBalance;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Adjust Balance</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter your actual balance. An adjustment transaction will be created automatically.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Balance
            </label>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(currentBalance, currency)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Balance
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                {symbol}
              </span>
              <input
                type="number"
                step="0.01"
                value={targetBalance}
                onChange={(e) => setTargetBalance(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>

          {adjustmentAmount !== 0 && !isNaN(adjustmentAmount) && (
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                This will create an adjustment of{" "}
                <span
                  className={`font-semibold ${
                    adjustmentAmount > 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {adjustmentAmount > 0 ? "+" : ""}
                  {formatCurrency(adjustmentAmount, currency)}
                </span>
              </p>
            </div>
          )}

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
              disabled={createAdjustment.isPending || adjustmentAmount === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createAdjustment.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
