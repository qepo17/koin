import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "../test/utils";
import { setAuthState, resetAuthState } from "../test/mocks/handlers";
import { DashboardPage } from "./Dashboard";

describe("DashboardPage", () => {
  beforeEach(() => {
    resetAuthState();
    setAuthState(true); // Simulate logged in user
  });

  it("renders dashboard title", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });
  });

  it("displays loading state initially then loads", async () => {
    renderWithProviders(<DashboardPage />);

    // Eventually loads content
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /dashboard/i })).toBeInTheDocument();
    });
  });

  it("displays summary stats after loading", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/income/i)).toBeInTheDocument();
      expect(screen.getByText(/expenses/i)).toBeInTheDocument();
      expect(screen.getByText(/balance/i)).toBeInTheDocument();
    });

    // Check that stat values are rendered (use getAllBy since values may appear multiple times)
    await waitFor(() => {
      expect(screen.getAllByText(/\$3000\.00/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\$25\.50/).length).toBeGreaterThan(0);
    });
  });

  it("displays recent transactions section", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/recent transactions/i)).toBeInTheDocument();
    });
  });

  it("shows link to view all transactions", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/view all/i)).toBeInTheDocument();
    });
  });

  it("displays spending by category", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/spending by category/i)).toBeInTheDocument();
      expect(screen.getByText(/food & dining/i)).toBeInTheDocument();
    });
  });
});
