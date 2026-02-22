import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ai, type AICommandPreview, type AIPreviewRecord, ApiError } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { formatCurrency } from "../lib/currency";

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "input" | "preview" | "success" | "error";

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const { user } = useAuth();
  const currency = user?.currency || "USD";
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("input");
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<AICommandPreview | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("input");
      setPrompt("");
      setPreview(null);
      setCountdown(0);
      setError(null);
      setSuccessCount(0);
    }
  }, [isOpen]);

  // Countdown timer — only depends on step, reads countdown via functional update
  useEffect(() => {
    if (step !== "preview") return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setStep("error");
          setError("Command expired. Please try again.");
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  const interpretMutation = useMutation({
    mutationFn: (prompt: string) => ai.interpret(prompt),
    onSuccess: (response) => {
      setPreview(response.data);
      setCountdown(response.data.expiresIn);
      setStep("preview");
    },
    onError: (err: Error) => {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string; code?: string; message?: string };
        if (data.code === "AI_NOT_CONFIGURED") {
          setError(data.message || "AI features are not available. Please contact the administrator.");
        } else {
          setError(data.error || "Failed to interpret command");
        }
      } else {
        setError(err.message || "Failed to interpret command");
      }
      setStep("error");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => ai.confirm(id),
    onSuccess: (response) => {
      setSuccessCount(response.data.result.updatedCount);
      setStep("success");
      // Invalidate transactions to refresh the list
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: (err: Error) => {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string };
        setError(data.error || "Failed to confirm command");
      } else {
        setError(err.message || "Failed to confirm command");
      }
      setStep("error");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => ai.cancel(id),
    onSuccess: () => {
      setStep("input");
      setPreview(null);
      setPrompt("");
    },
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim()) return;
      setError(null);
      interpretMutation.mutate(prompt.trim());
    },
    [prompt, interpretMutation]
  );

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    confirmMutation.mutate(preview.commandId);
  }, [preview, confirmMutation]);

  const handleCancel = useCallback(() => {
    if (!preview) return;
    cancelMutation.mutate(preview.commandId);
  }, [preview, cancelMutation]);

  const handleRetry = useCallback(() => {
    setStep("input");
    setError(null);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  const isLoading =
    interpretMutation.isPending ||
    confirmMutation.isPending ||
    cancelMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === "input" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Describe what you want to update in natural language.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='e.g., "Put all coffee transactions in the Food category"'
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                disabled={isLoading}
                autoFocus
              />
              <button
                type="submit"
                disabled={!prompt.trim() || isLoading}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    Processing...
                  </>
                ) : (
                  "Preview Changes"
                )}
              </button>
            </form>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Interpretation */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-700">"{preview.interpretation}"</p>
              </div>

              {/* Changes summary */}
              {preview.changes && Object.keys(preview.changes).length > 0 && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Changes: </span>
                  {preview.changes.categoryName && (
                    <span>Category → {preview.changes.categoryName}</span>
                  )}
                  {preview.changes.amount && (
                    <span>Amount → {formatCurrency(preview.changes.amount, currency)}</span>
                  )}
                  {preview.changes.description !== undefined && (
                    <span>Description → "{preview.changes.description}"</span>
                  )}
                </div>
              )}

              {/* Preview records */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Will update {preview.preview.matchCount} transaction
                  {preview.preview.matchCount !== 1 ? "s" : ""}:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {preview.preview.records.map((record) => (
                    <PreviewCard
                      key={record.id}
                      record={record}
                      changes={preview.changes || {}}
                      currency={currency}
                    />
                  ))}
                </div>
              </div>

              {/* Countdown */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Expires in {formatTime(countdown)}</span>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Success!</h3>
              <p className="text-gray-600">
                Updated {successCount} transaction{successCount !== 1 ? "s" : ""}.
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "preview" && (
          <div className="flex gap-3 p-4 border-t border-gray-200">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  Confirming...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm Update
                </>
              )}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCard({
  record,
  changes,
  currency,
}: {
  record: AIPreviewRecord;
  changes: AICommandPreview["changes"];
  currency: string;
}) {
  const date = record.date
    ? new Date(record.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

  const hasNewCategory = changes?.categoryName && changes.categoryName !== record.categoryName;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500">{date}</p>
          <p className="font-medium text-gray-900 truncate">
            {record.description || "No description"}
          </p>
          <div className="text-sm text-gray-600 mt-1">
            {hasNewCategory ? (
              <span>
                Category:{" "}
                <span className="text-gray-400 line-through">
                  {record.categoryName || "None"}
                </span>
                {" → "}
                <span className="text-emerald-600 font-medium">
                  {changes.categoryName}
                </span>
              </span>
            ) : (
              <span>Category: {record.categoryName || "None"}</span>
            )}
          </div>
        </div>
        <div className="ml-4 text-right">
          <p
            className={`font-semibold ${
              record.type === "income"
                ? "text-green-600"
                : record.type === "expense"
                ? "text-red-600"
                : "text-purple-600"
            }`}
          >
            {formatCurrency(record.amount, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Floating button component to trigger the assistant
export function AIAssistantButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 hover:scale-105 transition-all flex items-center justify-center z-40"
      aria-label="Open AI Assistant"
    >
      <span className="text-2xl">✨</span>
    </button>
  );
}
