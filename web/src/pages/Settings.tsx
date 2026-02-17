import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function SettingsPage() {
  const [downloading, setDownloading] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["skill-preview"],
    queryFn: async () => {
      const res = await api.skill.preview();
      if (!res.ok) throw new Error("Failed to load preview");
      return res.data;
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* AI Agent Integration */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          AI Agent Integration
        </h2>
        
        <p className="text-gray-600 mb-4">
          Download a personalized SKILL.md file to integrate Koin with your AI agent.
          The file includes your API credentials so your agent can manage your finances.
        </p>

        {isLoading ? (
          <div className="text-gray-500">Loading preview...</div>
        ) : preview ? (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 font-mono text-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-500">API URL:</span>
              <span className="text-gray-900">{preview.baseUrl}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Token:</span>
              <span className="text-gray-900">{preview.tokenPreview}</span>
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-4">
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

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex gap-2">
            <svg className="h-5 w-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Security Note</p>
              <p className="text-sm text-yellow-700 mt-1">
                This file contains your personal API token. Keep it secure and don't share it publicly.
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
          <li>Download the SKILL.md file above</li>
          <li>
            Copy it to your AI agent's skills directory:
            <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm">
              skills/koin/SKILL.md
            </code>
          </li>
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
