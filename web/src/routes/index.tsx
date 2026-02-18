import {
  createRootRoute,
  createRoute,
  Outlet,
  redirect,
  Navigate,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/useAuth";
import { auth } from "../lib/api";
import { Layout } from "../components/Layout";
import { LoginPage } from "../pages/Login";
import { RegisterPage } from "../pages/Register";
import { SetupPage } from "../pages/Setup";
import { DashboardPage } from "../pages/Dashboard";
import { TransactionsPage } from "../pages/Transactions";
import { CategoriesPage } from "../pages/Categories";
import { SettingsPage } from "../pages/Settings";

// Root layout
const rootRoute = createRootRoute({
  component: function RootComponent() {
    const { data, isLoading } = useQuery({
      queryKey: ["setup-status"],
      queryFn: () => auth.setupStatus(),
      staleTime: Infinity,
    });

    const location = useLocation();

    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-gray-500">Loading...</div>
        </div>
      );
    }

    const needsSetup = data?.data?.needsSetup;

    if (needsSetup && location.pathname !== "/setup") {
      return <Navigate to="/setup" />;
    }

    if (!needsSetup && location.pathname === "/setup") {
      return <Navigate to="/login" />;
    }

    return <Outlet />;
  },
});

// Auth layout (for login/register)
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  component: () => <Outlet />,
});

// Protected layout (requires auth)
const protectedLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "protected",
  component: () => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-lg text-gray-500">Loading...</div>
        </div>
      );
    }

    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }

    return (
      <Layout>
        <Outlet />
      </Layout>
    );
  },
});

// Setup layout
const setupLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "setup",
  component: () => <Outlet />,
});

const setupRoute = createRoute({
  getParentRoute: () => setupLayout,
  path: "/setup",
  component: SetupPage,
});

// Auth routes
const loginRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => authLayout,
  path: "/register",
  component: RegisterPage,
});

// Protected routes
const dashboardRoute = createRoute({
  getParentRoute: () => protectedLayout,
  path: "/",
  component: DashboardPage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => protectedLayout,
  path: "/transactions",
  component: TransactionsPage,
});

const categoriesRoute = createRoute({
  getParentRoute: () => protectedLayout,
  path: "/categories",
  component: CategoriesPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => protectedLayout,
  path: "/settings",
  component: SettingsPage,
});

// Build route tree
export const routeTree = rootRoute.addChildren([
  setupLayout.addChildren([setupRoute]),
  authLayout.addChildren([loginRoute, registerRoute]),
  protectedLayout.addChildren([
    dashboardRoute,
    transactionsRoute,
    categoriesRoute,
    settingsRoute,
  ]),
]);
