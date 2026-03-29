import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rules,
  categories,
  type Rule,
  type CreateRule,
  type UpdateRule,
  type Category,
  type RuleCondition,
  type DescriptionCondition,
  type AmountCondition,
} from "../lib/api";

const DESC_OPERATORS: Record<DescriptionCondition["operator"], string> = {
  contains: "Contains",
  startsWith: "Starts with",
  endsWith: "Ends with",
  exact: "Exact match",
};

const AMOUNT_OPERATORS: Record<AmountCondition["operator"], string> = {
  eq: "=",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  between: "Between",
};

function formatCondition(c: RuleCondition): string {
  if (c.field === "description") {
    const neg = c.negate ? "NOT " : "";
    const cs = c.caseSensitive ? " (case-sensitive)" : "";
    return `${neg}Description ${DESC_OPERATORS[c.operator].toLowerCase()} "${c.value}"${cs}`;
  }
  if (c.operator === "between") {
    return `Amount between ${c.value.toLocaleString()} and ${(c.value2 ?? 0).toLocaleString()}`;
  }
  return `Amount ${AMOUNT_OPERATORS[c.operator]} ${c.value.toLocaleString()}`;
}

function emptyDescriptionCondition(): DescriptionCondition {
  return { field: "description", operator: "contains", value: "" };
}

export function RulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTestModal, setShowTestModal] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ id: string; count: number } | null>(null);

  const { data: ruleList, isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: () => rules.list(),
  });

  const { data: catList } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categories.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      rules.update(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => rules.apply(id),
    onSuccess: (data, id) => {
      setApplyResult({ id, count: data.data.categorized });
      setApplyingId(null);
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: () => {
      setApplyingId(null);
    },
  });

  const allRules = ruleList?.data ?? [];
  const catsMap = new Map((catList?.data ?? []).map((c) => [c.id, c]));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rules</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700"
        >
          Add Rule
        </button>
      </div>

      {/* Apply result toast */}
      {applyResult && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-4 py-3 flex items-center justify-between">
          <span>
            ✅ Applied rule — {applyResult.count} transaction{applyResult.count !== 1 ? "s" : ""} categorized
          </span>
          <button
            onClick={() => setApplyResult(null)}
            className="text-emerald-600 hover:text-emerald-800 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <RuleForm
          editingRule={editingId ? allRules.find((r) => r.id === editingId) : undefined}
          categories={catList?.data ?? []}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}

      {/* Test Modal */}
      {showTestModal && (
        <TestRuleModal
          ruleId={showTestModal}
          ruleName={allRules.find((r) => r.id === showTestModal)?.name ?? ""}
          onClose={() => setShowTestModal(null)}
        />
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : allRules.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          No rules yet. Click "Add Rule" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {allRules.map((rule) => {
            const cat = catsMap.get(rule.categoryId);
            return (
              <div
                key={rule.id}
                className={`bg-white rounded-lg shadow p-4 ${!rule.enabled ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">{rule.name}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        Priority: {rule.priority}
                      </span>
                      {cat && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {rule.matchCount} match{rule.matchCount !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rule.conditions.map((cond, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                        >
                          {formatCondition(cond)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.enabled ? "bg-emerald-600" : "bg-gray-300"
                      }`}
                      title={rule.enabled ? "Disable" : "Enable"}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    {/* Apply */}
                    <button
                      onClick={() => {
                        setApplyingId(rule.id);
                        applyMutation.mutate(rule.id);
                      }}
                      disabled={applyingId === rule.id}
                      className="text-sm text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
                      title="Apply to uncategorized transactions"
                    >
                      {applyingId === rule.id ? "Applying..." : "Apply"}
                    </button>
                    {/* Test */}
                    <button
                      onClick={() => setShowTestModal(rule.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Test
                    </button>
                    {/* Edit */}
                    <button
                      onClick={() => {
                        setEditingId(rule.id);
                        setShowForm(true);
                      }}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      Edit
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm("Delete this rule?")) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      className="text-sm text-gray-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Rule Form Modal ──────────────────────────────────────────────────────────

function RuleForm({
  editingRule,
  categories: cats,
  onClose,
}: {
  editingRule?: Rule;
  categories: Category[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editingRule?.name ?? "");
  const [categoryId, setCategoryId] = useState(editingRule?.categoryId ?? "");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    editingRule?.conditions ?? [emptyDescriptionCondition()]
  );
  const [priority, setPriority] = useState(editingRule?.priority ?? 0);
  const [enabled, setEnabled] = useState(editingRule?.enabled ?? true);

  const createMutation = useMutation({
    mutationFn: (data: CreateRule) => rules.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRule }) =>
      rules.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateRule = {
      name,
      categoryId,
      conditions,
      priority,
      enabled,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const updateCondition = (index: number, updated: RuleCondition) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? updated : c)));
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const addCondition = () => {
    setConditions((prev) => [...prev, emptyDescriptionCondition()]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {editingRule ? "Edit Rule" : "Add Rule"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Grab rides"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select category...</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conditions
            </label>
            <div className="space-y-3">
              {conditions.map((cond, i) => (
                <ConditionEditor
                  key={i}
                  condition={cond}
                  onChange={(updated) => updateCondition(i, updated)}
                  onRemove={conditions.length > 1 ? () => removeCondition(i) : undefined}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addCondition}
              className="mt-2 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
            >
              + Add condition
            </button>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-gray-400 mt-1">Higher priority rules are evaluated first</p>
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rule-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="rule-enabled" className="text-sm font-medium text-gray-700">
              Enabled
            </label>
          </div>

          {/* Actions */}
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

// ── Condition Editor ─────────────────────────────────────────────────────────

function ConditionEditor({
  condition,
  onChange,
  onRemove,
}: {
  condition: RuleCondition;
  onChange: (c: RuleCondition) => void;
  onRemove?: () => void;
}) {
  const switchField = (field: "description" | "amount") => {
    if (field === "description") {
      onChange(emptyDescriptionCondition());
    } else {
      onChange({ field: "amount", operator: "gt", value: 0 });
    }
  };

  return (
    <div className="border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
      <div className="flex items-center gap-2">
        {/* Field selector */}
        <select
          value={condition.field}
          onChange={(e) => switchField(e.target.value as "description" | "amount")}
          className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="description">Description</option>
          <option value="amount">Amount</option>
        </select>

        {condition.field === "description" ? (
          <>
            {/* Description operator */}
            <select
              value={condition.operator}
              onChange={(e) =>
                onChange({
                  ...condition,
                  operator: e.target.value as DescriptionCondition["operator"],
                })
              }
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.entries(DESC_OPERATORS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {/* Value */}
            <input
              type="text"
              value={condition.value}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              required
              placeholder="Value..."
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </>
        ) : (
          <>
            {/* Amount operator */}
            <select
              value={condition.operator}
              onChange={(e) => {
                const op = e.target.value as AmountCondition["operator"];
                const base: AmountCondition = { field: "amount", operator: op, value: condition.value };
                if (op === "between") base.value2 = 0;
                onChange(base);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.entries(AMOUNT_OPERATORS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {/* Amount value */}
            <input
              type="number"
              value={condition.value}
              onChange={(e) =>
                onChange({ ...condition, value: parseFloat(e.target.value) || 0 })
              }
              required
              placeholder="Amount..."
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {condition.operator === "between" && (
              <>
                <span className="text-sm text-gray-500">and</span>
                <input
                  type="number"
                  value={condition.value2 ?? 0}
                  onChange={(e) =>
                    onChange({ ...condition, value2: parseFloat(e.target.value) || 0 })
                  }
                  required
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </>
            )}
          </>
        )}

        {/* Remove */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 text-lg leading-none"
            title="Remove condition"
          >
            ×
          </button>
        )}
      </div>

      {/* Description extra options */}
      {condition.field === "description" && (
        <div className="flex items-center gap-4 pl-1">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={condition.negate ?? false}
              onChange={(e) => onChange({ ...condition, negate: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
            />
            Negate
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={condition.caseSensitive ?? false}
              onChange={(e) => onChange({ ...condition, caseSensitive: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600"
            />
            Case sensitive
          </label>
        </div>
      )}
    </div>
  );
}

// ── Test Rule Modal ──────────────────────────────────────────────────────────

function TestRuleModal({
  ruleId,
  ruleName,
  onClose,
}: {
  ruleId: string;
  ruleName: string;
  onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<boolean | null>(null);

  const testMutation = useMutation({
    mutationFn: (body: { ruleId: string; transaction: { description: string; amount: number } }) =>
      rules.test(body),
    onSuccess: (data) => {
      setResult(data.data.match);
    },
  });

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    testMutation.mutate({
      ruleId,
      transaction: {
        description,
        amount: parseFloat(amount) || 0,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-1">Test Rule</h2>
        <p className="text-sm text-gray-500 mb-4">Testing: {ruleName}</p>

        <form onSubmit={handleTest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., Grab ride to office"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g., 50000"
            />
          </div>

          {result !== null && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                result
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {result ? "✅ Match! This transaction would be categorized." : "❌ No match."}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={testMutation.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {testMutation.isPending ? "Testing..." : "Test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
