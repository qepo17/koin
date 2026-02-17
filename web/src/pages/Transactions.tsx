import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  transactions,
  categories,
  type Transaction,
  type CreateTransaction,
} from "../lib/api";

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: txList, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => transactions.list(),
  });

  const { data: catList } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categories.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  const txs = txList?.data ?? [];
  const cats = catList?.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700"
        >
          Add Transaction
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <TransactionForm
          categories={cats}
          editingTransaction={
            editingId ? txs.find((t) => t.id === editingId) : undefined
          }
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {/* Transactions List */}
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : txs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No transactions yet. Click "Add Transaction" to create one.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {txs.map((tx) => (
              <li
                key={tx.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        tx.type === "income"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {tx.type}
                    </span>
                    <p className="font-medium text-gray-900">
                      {tx.description || "No description"}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(tx.date).toLocaleDateString()} •{" "}
                    {cats.find((c) => c.id === tx.categoryId)?.name ||
                      "No category"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`text-lg font-semibold ${
                      tx.type === "income" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}$
                    {parseFloat(tx.amount).toFixed(2)}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(tx.id);
                      setShowForm(true);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this transaction?")) {
                        deleteMutation.mutate(tx.id);
                      }
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TransactionForm({
  categories,
  editingTransaction,
  onClose,
}: {
  categories: { id: string; name: string }[];
  editingTransaction?: Transaction;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<"income" | "expense">(
    editingTransaction?.type ?? "expense"
  );
  const [amount, setAmount] = useState(editingTransaction?.amount ?? "");
  const [description, setDescription] = useState(
    editingTransaction?.description ?? ""
  );
  const [categoryId, setCategoryId] = useState(
    editingTransaction?.categoryId ?? ""
  );
  const [date, setDate] = useState(
    editingTransaction?.date
      ? new Date(editingTransaction.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateTransaction) => transactions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransaction> }) =>
      transactions.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateTransaction = {
      type,
      amount,
      description: description || undefined,
      categoryId: categoryId || undefined,
      date: new Date(date).toISOString(),
    };

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingTransaction ? "Edit Transaction" : "Add Transaction"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="expense"
                  checked={type === "expense"}
                  onChange={() => setType("expense")}
                  className="mr-2"
                />
                Expense
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="income"
                  checked={type === "income"}
                  onChange={() => setType("income")}
                  className="mr-2"
                />
                Income
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="What was this for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
