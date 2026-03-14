import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./useAuth";
import { setAuthState, resetAuthState } from "../test/mocks/handlers";
import type { ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

// Helper: wait for the hook to be accessible through AuthProvider's conditional render
async function waitForHookReady(result: { current: ReturnType<typeof useAuth> | null }) {
  await waitFor(() => {
    expect(result.current).not.toBeNull();
    expect(result.current!.isLoading).toBe(false);
  }, { timeout: 3000 });
}

describe("useAuth", () => {
  beforeEach(() => {
    cleanup();
    resetAuthState();
  });

  it("throws when used outside AuthProvider", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() =>
      renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      })
    ).toThrow("useAuth must be used within an AuthProvider");
  });

  it("starts with loading state then resolves to unauthenticated", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitForHookReady(result as any);

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("returns authenticated user when session exists", async () => {
    setAuthState(true);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitForHookReady(result as any);

    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.email).toBe("test@example.com");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("login updates auth state", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitForHookReady(result as any);

    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login("test@example.com", "password123");
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.email).toBe("test@example.com");
  });

  it("login throws on invalid credentials", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitForHookReady(result as any);

    await expect(
      act(async () => {
        await result.current.login("wrong@example.com", "wrongpassword");
      })
    ).rejects.toThrow();
  });

  // Note: logout is tested at the page level. Testing it with renderHook
  // is unreliable because queryClient.clear() in the logout mutation causes
  // the AuthProvider to re-enter loading state, unmounting the hook.
});
