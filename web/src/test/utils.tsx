import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter, createMemoryHistory, createRootRoute, createRoute, Outlet } from "@tanstack/react-router";
import { AuthProvider } from "../hooks/useAuth";
import type { ReactElement, ReactNode } from "react";

// Create a fresh query client for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Create a minimal router for testing individual components
function createTestRouter(component: ReactElement) {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });

  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => component,
  });

  const routeTree = rootRoute.addChildren([testRoute]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialRoute?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { initialRoute = "/", ...options }: CustomRenderOptions = {}
) {
  const queryClient = createTestQueryClient();
  const router = createTestRouter(ui);

  function Wrapper({ children: _ }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  // Note: We render the RouterProvider which includes the component
  // So we pass a fragment as ui to avoid double-rendering
  return {
    ...render(<></>, { wrapper: Wrapper, ...options }),
    queryClient,
    router,
  };
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
