import { useQuery } from "@tanstack/react-query";
import { summary, transactions } from "../lib/api";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency, formatCurrencyWithSign } from "../lib/currency";

export function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.currency || "USD";

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["summary"],
    queryFn: () => summary.get(),
  });

  const { data: recentTransactions, isLoading: transactionsLoading } = useQuery(
    {
      queryKey: ["transactions", "recent"],
      queryFn: () => transactions.list(),
    }
  );

  const stats = summaryData?.data;
  const recent = recentTransactions?.data?.slice(0, 5) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Income"
          value={stats?.income ?? 0}
          currency={currency}
          isLoading={summaryLoading}
          color="green"
        />
        <StatCard
          title="Expenses"
          value={stats?.expenses ?? 0}
          currency={currency}
          isLoading={summaryLoading}
          color="red"
        />
        <StatCard
          title="Balance"
          value={stats?.balance ?? 0}
          currency={currency}
          isLoading={summaryLoading}
          color="blue"
        />
      </div>

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
                    tx.type === "income" ? "text-green-600" : "text-red-600"
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
}: {
  title: string;
  value: number;
  currency: string;
  isLoading: boolean;
  color: "green" | "red" | "blue";
}) {
  const colorClasses = {
    green: "text-green-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      {isLoading ? (
        <div className="mt-2 h-8 bg-gray-200 rounded animate-pulse" />
      ) : (
        <p className={`mt-2 text-3xl font-bold ${colorClasses[color]}`}>
          {formatCurrency(value, currency)}
        </p>
      )}
    </div>
  );
}
