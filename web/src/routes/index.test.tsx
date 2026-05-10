import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../hooks/useAuth";
import { PrivacyProvider } from "../hooks/usePrivacy";
import { server } from "../test/mocks/server";
import { setAuthState } from "../test/mocks/handlers";
import { routeTree } from ".";

function renderApp(initialRoute: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialRoute] }),
    context: { queryClient },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PrivacyProvider>
          <RouterProvider router={router} />
        </PrivacyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );

  return { router };
}

describe("auth routes", () => {
  it("redirects authenticated users away from login", async () => {
    setAuthState(true);
    server.use(
      http.get("/api/auth/setup-status", () =>
        HttpResponse.json({ data: { needsSetup: false } })
      ),
      http.get("/api/summary/trend", () =>
        HttpResponse.json({
          data: { period: "daily", from: "2026-05-01", to: "2026-05-10", points: [] },
        })
      )
    );

    const { router } = renderApp("/login");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
  });
});
