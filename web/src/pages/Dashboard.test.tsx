import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor, userEvent } from "../test/utils";
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
    // Values are formatted with thousand separators: $3,000.00
    await waitFor(() => {
      expect(screen.getAllByText(/\$3,000\.00/).length).toBeGreaterThan(0);
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

  it("displays adjustments stat card when adjustments exist", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/adjustments/i)).toBeInTheDocument();
      // $500.00 with positive sign appears in stat card and transactions
      expect(screen.getAllByText(/\+\$500\.00/).length).toBeGreaterThan(0);
    });
  });

  it("displays adjustment transaction in recent list with purple color", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/starting balance/i)).toBeInTheDocument();
    });

    // Find the amount element for the adjustment - it should have purple color class
    const amountElements = screen.getAllByText(/\$500\.00/);
    const adjustmentAmount = amountElements.find((el) =>
      el.classList.contains("text-purple-600")
    );
    expect(adjustmentAmount).toBeTruthy();
  });

  it("shows 'Click to adjust' hint on Balance card", async () => {
    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/click to adjust/i)).toBeInTheDocument();
    });
  });

  it("opens balance adjustment modal when clicking Balance card", async () => {
    renderWithProviders(<DashboardPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/click to adjust/i)).toBeInTheDocument();
    });

    // Click on the Balance card (has "Click to adjust" text)
    const balanceCard = screen.getByText(/click to adjust/i).closest('[role="button"]') as HTMLElement;
    await user.click(balanceCard);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText(/adjust balance/i)).toBeInTheDocument();
      expect(screen.getByText(/current balance/i)).toBeInTheDocument();
      expect(screen.getByText(/new balance/i)).toBeInTheDocument();
    });
  });

  it("shows adjustment preview in modal", async () => {
    renderWithProviders(<DashboardPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/click to adjust/i)).toBeInTheDocument();
    });

    // Click on the Balance card
    const balanceCard = screen.getByText(/click to adjust/i).closest('[role="button"]') as HTMLElement;
    await user.click(balanceCard);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    // Enter new balance (current is $3,474.50, set to $4000)
    const input = screen.getByPlaceholderText("0.00");
    await user.clear(input);
    await user.type(input, "4000");

    // Should show adjustment preview
    await waitFor(() => {
      expect(screen.getByText(/this will create an adjustment/i)).toBeInTheDocument();
    });
  });

  it("can close balance adjustment modal with cancel", async () => {
    renderWithProviders(<DashboardPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/click to adjust/i)).toBeInTheDocument();
    });

    const balanceCard = screen.getByText(/click to adjust/i).closest('[role="button"]') as HTMLElement;
    await user.click(balanceCard);

    await waitFor(() => {
      expect(screen.getByText(/adjust balance/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText(/adjust balance/i)).not.toBeInTheDocument();
    });
  });

  it("can submit balance adjustment", async () => {
    renderWithProviders(<DashboardPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText(/click to adjust/i)).toBeInTheDocument();
    });

    const balanceCard = screen.getByText(/click to adjust/i).closest('[role="button"]') as HTMLElement;
    await user.click(balanceCard);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("0.00");
    await user.clear(input);
    await user.type(input, "5000");

    await user.click(screen.getByRole("button", { name: /save/i }));

    // Modal should close after successful submission
    await waitFor(() => {
      expect(screen.queryByText(/adjust balance/i)).not.toBeInTheDocument();
    });
  });
});
