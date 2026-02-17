import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { skill, type ApiToken } from "../lib/api";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenExpiry, setTokenExpiry] = useState("never");

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["skill-preview"],
    queryFn: async () => {
      const res = await skill.preview();
      if (!res.ok) throw new Error("Failed to load preview");
      return res.data;
    },
  });

  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: async () => {
      const res = await skill.listTokens();
      return res.data;
    },
  });

  const createTokenMutation = useMutation({
    mutationFn: async (data: { name: string; expiresIn: string }) => {
      const res = await skill.createToken(data);
      return res.data;
    },
    onSuccess: (data) => {
      setNewToken({ token: data.token, name: data.name });
      setShowCreateForm(false);
      setTokenName("");
      setTokenExpiry("never");
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      await skill.revokeToken(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/api/skill/download`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SKILL.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download SKILL.md");
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyToken = async () => {
    if (newToken) {
      await navigator.clipboard.writeText(newToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateToken = () => {
    if (!tokenName.trim()) return;
    createTokenMutation.mutate({ name: tokenName.trim(), expiresIn: tokenExpiry });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* AI Agent Integration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          AI Agent Integration
        </h2>

        <p className="text-gray-600 mb-4">
          Download SKILL.md and create an API token to integrate Koin with your AI agent.
        </p>

        {/* API URL */}
        {previewLoading ? (
          <div className="text-gray-500 mb-4">Loading...</div>
        ) : preview ? (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">API URL:</span>
              <code className="text-sm text-gray-900 bg-gray-100 px-2 py-1 rounded">
                {preview.baseUrl}
              </code>
            </div>
          </div>
        ) : null}

        {/* Download SKILL.md */}
        <div className="mb-6">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {downloading ? "Downloading..." : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download SKILL.md
              </>
            )}
          </button>
        </div>
      </div>

      {/* Newly Created Token Display */}
      {newToken && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <svg className="h-6 w-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-green-800">Token Created: {newToken.name}</h3>
              <p className="text-sm text-green-700 mt-1">
                Copy this token now. It won't be shown again!
              </p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 p-3 bg-gray-900 text-green-400 text-xs rounded font-mono break-all">
                  {newToken.token}
                </code>
                <button
                  onClick={handleCopyToken}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => setNewToken(null)}
                className="mt-3 text-sm text-green-700 hover:text-green-800"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Tokens */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">API Tokens</h2>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
          >
            + Create Token
          </button>
        </div>

        {/* Create Token Form */}
        {showCreateForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="e.g., My AI Agent"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration
                </label>
                <select
                  value={tokenExpiry}
                  onChange={(e) => setTokenExpiry(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="never">Never expires</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="90d">90 days</option>
                  <option value="1y">1 year</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateToken}
                  disabled={!tokenName.trim() || createTokenMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400"
                >
                  {createTokenMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  onClick={() => { setShowCreateForm(false); setTokenName(""); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Token List */}
        {tokensLoading ? (
          <div className="text-gray-500">Loading tokens...</div>
        ) : tokens && tokens.length > 0 ? (
          <div className="space-y-3">
            {tokens.map((token: ApiToken) => (
              <div key={token.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{token.name}</div>
                  <div className="text-sm text-gray-500">
                    <code className="bg-gray-200 px-1 rounded">{token.tokenPrefix}</code>
                    {" · "}
                    Expires: {formatDate(token.expiresAt)}
                    {token.lastUsedAt && (
                      <> · Last used: {formatDate(token.lastUsedAt)}</>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Revoke this token? Any integrations using it will stop working.")) {
                      revokeTokenMutation.mutate(token.id);
                    }
                  }}
                  disabled={revokeTokenMutation.isPending}
                  className="px-3 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded text-sm"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">
            No API tokens yet. Create one to integrate with your AI agent.
          </div>
        )}
      </div>

      {/* Security & Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How to Use</h2>
        
        <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-4">
          <li>Download SKILL.md and place it in your agent's skills directory</li>
          <li>Create an API token and copy it</li>
          <li>Store the token as <code className="px-1 bg-gray-100 rounded">KOIN_API_TOKEN</code> environment variable</li>
        </ol>

        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <code className="text-sm text-green-400 font-mono">
            export KOIN_API_TOKEN="koin_your_token_here"
          </code>
        </div>

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Security:</strong> Never commit tokens to version control. Store them in environment variables or a secrets manager.
          </p>
        </div>
      </div>
    </div>
  );
}
