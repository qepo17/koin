import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Subscription, CreateSubscriptionData, UpdateSubscriptionData } from "../lib/api";
import { formatCurrency } from "../lib/currency";
import { useAuth } from "../hooks/useAuth";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription?: Subscription;
  categories: Array<{ id: string; name: string }>;
}

function SubscriptionModal({ isOpen, onClose, subscription, categories }: SubscriptionModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [formData, setFormData] = useState<CreateSubscriptionData>({
    name: subscription?.name || "",
    amount: subscription?.amount || "",
    billingCycle: subscription?.billingCycle || "monthly",
    billingDay: subscription?.billingDay || undefined,
    categoryId: subscription?.categoryId || "",
    description: subscription?.description || "",
    url: subscription?.url || "",
    autoTrack: subscription?.autoTrack ?? true,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSubscriptionData) => api.subscriptions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions", "summary"] });
      onClose();
      setFormData({
        name: "",
        amount: "",
        billingCycle: "monthly",
        categoryId: "",
        description: "",
        url: "",
        autoTrack: true,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSubscriptionData }) =>
      api.subscriptions.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions", "summary"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subscription) {
      updateMutation.mutate({ id: subscription.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {subscription ? "Edit Subscription" : "Add New Subscription"}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Netflix, Spotify"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount ({user?.currency || "USD"}) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Cycle *
              </label>
              <select
                value={formData.billingCycle}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  billingCycle: e.target.value as CreateSubscriptionData["billingCycle"]
                })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Billing Day
              </label>
              <input
                type="number"
                min="1"
                max={formData.billingCycle === "weekly" ? "7" : "31"}
                value={formData.billingDay || ""}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  billingDay: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                placeholder={formData.billingCycle === "weekly" ? "Day of week (1-7)" : "Day of month (1-31)"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.billingCycle === "weekly" 
                  ? "1=Monday, 7=Sunday. Leave blank to use start date." 
                  : "Leave blank to use start date."}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.categoryId || ""}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL
              </label>
              <input
                type="url"
                value={formData.url || ""}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://netflix.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoTrack"
                checked={formData.autoTrack}
                onChange={(e) => setFormData({ ...formData, autoTrack: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="autoTrack" className="text-sm text-gray-700">
                Auto-create transactions on billing day
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "Saving..." 
                  : subscription ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SubscriptionCard({ subscription, categories, onEdit }: {
  subscription: Subscription;
  categories: Array<{ id: string; name: string }>;
  onEdit: (subscription: Subscription) => void;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.subscriptions.pause(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions", "summary"] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.subscriptions.resume(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions", "summary"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.subscriptions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions", "summary"] });
    },
  });

  const categoryName = categories.find(c => c.id === subscription.categoryId)?.name || "No category";
  const nextBilling = new Date(subscription.nextBillingDate);
  const isUpcoming = nextBilling.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // Within 7 days

  return (
    <div className={`bg-white rounded-lg border p-4 ${
      subscription.status === "paused" ? "opacity-75" : ""
    } ${subscription.status === "cancelled" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900">{subscription.name}</h3>
            {subscription.url && (
              <a 
                href={subscription.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 text-sm"
              >
                🔗
              </a>
            )}
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(parseFloat(subscription.amount), user?.currency || "USD")}
            <span className="text-sm font-normal text-gray-500 ml-1">
              / {subscription.billingCycle}
            </span>
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(subscription)}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Edit"
          >
            ✏️
          </button>
          
          {subscription.status === "active" && (
            <button
              onClick={() => pauseMutation.mutate(subscription.id)}
              disabled={pauseMutation.isPending}
              className="p-1 text-gray-400 hover:text-yellow-600"
              title="Pause"
            >
              ⏸️
            </button>
          )}
          
          {subscription.status === "paused" && (
            <button
              onClick={() => resumeMutation.mutate(subscription.id)}
              disabled={resumeMutation.isPending}
              className="p-1 text-gray-400 hover:text-green-600"
              title="Resume"
            >
              ▶️
            </button>
          )}
          
          <button
            onClick={() => {
              if (confirm("Are you sure you want to cancel this subscription?")) {
                deleteMutation.mutate(subscription.id);
              }
            }}
            disabled={deleteMutation.isPending}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Cancel"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Category:</span>
          <span>{categoryName}</span>
        </div>
        
        <div className="flex justify-between">
          <span>Next billing:</span>
          <span className={isUpcoming ? "text-orange-600 font-medium" : ""}>
            {nextBilling.toLocaleDateString()}
            {isUpcoming && " (Soon)"}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Status:</span>
          <span className={`capitalize ${
            subscription.status === "active" 
              ? "text-green-600" 
              : subscription.status === "paused" 
                ? "text-yellow-600" 
                : "text-red-600"
          }`}>
            {subscription.status}
          </span>
        </div>
        
        {subscription.description && (
          <div className="pt-2 border-t">
            <p className="text-gray-700">{subscription.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SubscriptionsPage() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | undefined>();
  const [statusFilter, setStatusFilter] = useState("active");
  const [cycleFilter, setCycleFilter] = useState("");

  // Fetch subscriptions
  const { data: subscriptionsData, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["subscriptions", statusFilter, cycleFilter],
    queryFn: () => api.subscriptions.list({ 
      status: statusFilter || undefined,
      billingCycle: cycleFilter || undefined,
    }),
  });

  // Fetch subscription summary
  const { data: summaryData } = useQuery({
    queryKey: ["subscriptions", "summary"],
    queryFn: () => api.subscriptions.summary(),
  });

  // Fetch categories for the modal
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
  });

  const subscriptions = subscriptionsData?.data || [];
  const summary = summaryData?.data;
  const categories = categoriesData?.data || [];

  const handleAddClick = () => {
    setEditingSubscription(undefined);
    setIsModalOpen(true);
  };

  const handleEditClick = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingSubscription(undefined);
  };

  if (subscriptionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">Loading subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            ➕ Add Subscription
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-500">Monthly Total</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(parseFloat(summary.monthlyTotal), user?.currency || "USD")}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-500">Yearly Total</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(parseFloat(summary.yearlyTotal), user?.currency || "USD")}
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <h3 className="text-sm font-medium text-gray-500">Active Subscriptions</h3>
              <p className="text-2xl font-bold text-gray-900">{summary.activeCount}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={cycleFilter}
            onChange={(e) => setCycleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Cycles</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      {/* Subscriptions Grid */}
      {subscriptions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              categories={categories}
              onEdit={handleEditClick}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            {statusFilter === "active" 
              ? "No active subscriptions found."
              : `No ${statusFilter} subscriptions found.`}
          </div>
          <button
            onClick={handleAddClick}
            className="text-blue-600 hover:text-blue-700"
          >
            Add your first subscription
          </button>
        </div>
      )}

      {/* Upcoming Billing */}
      {summary && summary.upcomingThisWeek.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Upcoming This Week</h2>
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <div className="space-y-2">
              {summary.upcomingThisWeek.map((item) => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-gray-900">{item.name}</span>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(parseFloat(item.amount), user?.currency || "USD")}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(item.nextBillingDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        subscription={editingSubscription}
        categories={categories}
      />
    </div>
  );
}