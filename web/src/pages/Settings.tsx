import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export function SettingsPage() {
  const [downloading, setDownloading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["skill-preview"],
    queryFn: async () => {
      const res = await api.skill.preview();
      if (!res.ok) throw new Error("Failed to load preview");
      return res.data;
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await api.skill.generateToken();
      if (!res.ok) throw new Error("Failed to generate token");
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setCopied(false);
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
    if (generatedToken) {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          Download a SKILL.md file and generate an API token to integrate Koin with your AI agent.
        </p>

        {/* API URL */}
        {isLoading ? (
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

        {/* Step 1: Download SKILL.md */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Step 1: Download SKILL.md
          </h3>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Downloading...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download SKILL.md
              </>
            )}
          </button>
        </div>

        {/* Step 2: Generate Token */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Step 2: Generate API Token
          </h3>
          <button
            onClick={() => generateTokenMutation.mutate()}
            disabled={generateTokenMutation.isPending}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generateTokenMutation.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Generate Token
              </>
            )}
          </button>

          {/* Generated Token Display */}
          {generatedToken && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Your API Token:</span>
                <button
                  onClick={handleCopyToken}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              <code className="block w-full p-3 bg-gray-900 text-green-400 text-xs rounded font-mono break-all">
                {generatedToken}
              </code>
            </div>
          )}
        </div>

        {/* Step 3: Set Environment Variable */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Step 3: Store Token Securely
          </h3>
          <div className="bg-gray-900 rounded-lg p-4">
            <code className="text-sm text-green-400 font-mono">
              export KOIN_API_TOKEN="your-token-here"
            </code>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Add this to your shell profile (~/.bashrc, ~/.zshrc) or your agent's environment.
          </p>
        </div>

        {/* Security Warning */}
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="h-5 w-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Security Note</p>
              <p className="text-sm text-yellow-700 mt-1">
                Never commit your API token to version control. Store it in environment variables or a secrets manager.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          How to Use
        </h2>
        
        <ol className="list-decimal list-inside space-y-3 text-gray-600">
          <li>Download the SKILL.md file and place it in your agent's skills directory</li>
          <li>Generate an API token and store it as <code className="px-1 bg-gray-100 rounded">KOIN_API_TOKEN</code></li>
          <li>Your agent can now manage your finances using natural language</li>
        </ol>

        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Example commands:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• "Log a $25 expense for lunch"</li>
            <li>• "How much did I spend this month?"</li>
            <li>• "Show my spending by category"</li>
            <li>• "Add $3000 income for salary"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
