import {
  createRootRoute,
  createRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useAuth } from "../hooks/useAuth";
import { Layout } from "../components/Layout";
import { LoginPage } from "../pages/Login";
import { RegisterPage } from "../pages/Register";
import { DashboardPage } from "../pages/Dashboard";
import { TransactionsPage } from "../pages/Transactions";
import { CategoriesPage } from "../pages/Categories";

// Root layout
const rootRoute = createRootRoute({
  component: () => <Outlet />,
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

// Build route tree
export const routeTree = rootRoute.addChildren([
  authLayout.addChildren([loginRoute, registerRoute]),
  protectedLayout.addChildren([
    dashboardRoute,
    transactionsRoute,
    categoriesRoute,
  ]),
]);
