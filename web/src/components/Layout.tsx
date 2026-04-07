import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { usePrivacy } from "../hooks/usePrivacy";
import { AIAssistant, AIAssistantButton } from "./AIAssistant";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/transactions", label: "Transactions" },
  { to: "/categories", label: "Categories" },
  { to: "/rules", label: "Rules" },
  { to: "/debts", label: "Debts" },
  { to: "/subscriptions", label: "Subscriptions" },
  { to: "/settings", label: "Settings" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { privacyMode, togglePrivacy, isLoading: privacyLoading } = usePrivacy();
  const navigate = useNavigate();
  const [showAI, setShowAI] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪙</span>
              <span className="text-xl font-semibold text-gray-900">Koin</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-gray-600 hover:text-gray-900 font-medium"
                  activeProps={{ className: "text-emerald-600" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* User menu */}
            <div className="flex items-center gap-4">
              {/* Privacy Toggle */}
              <button
                onClick={togglePrivacy}
                disabled={privacyLoading}
                className={`
                  p-2 rounded-lg transition-colors
                  ${privacyMode 
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}
                  ${privacyLoading ? "opacity-50 cursor-not-allowed" : ""}
                `}
                title={privacyMode ? "Privacy mode is on - Click to disable" : "Privacy mode is off - Click to enable"}
              >
                {privacyMode ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>

              <span className="text-sm text-gray-600">
                {user?.name || user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* AI Assistant */}
      <AIAssistantButton onClick={() => setShowAI(true)} />
      <AIAssistant isOpen={showAI} onClose={() => setShowAI(false)} />
    </div>
  );
}
