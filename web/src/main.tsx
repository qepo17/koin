import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routes";
import { AuthProvider } from "./hooks/useAuth";
import { ApiError } from "./lib/api";
import "./index.css";

// Module-level reference for the queryClient (set after creation)
let queryClientRef: QueryClient | null = null;

// Global handler for 401 errors - clears auth state to trigger redirect
const handle401 = (error: unknown): void => {
  if (error instanceof ApiError && error.status === 401 && queryClientRef) {
    // Clear auth state - this will trigger redirect to login
    queryClientRef.setQueryData(["auth", "me"], null);
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: handle401,
  }),
  mutationCache: new MutationCache({
    onError: handle401,
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: (failureCount, error) => {
        // Don't retry on 401
        if (error instanceof ApiError && error.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

// Set the reference after creation
queryClientRef = queryClient;

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
