import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { setAuthState, resetAuthState } from "../test/mocks/handlers";
import { TransactionsPage } from "./Transactions";

describe("TransactionsPage", () => {
  beforeEach(() => {
    resetAuthState();
    setAuthState(true);
  });

  it("renders page title and add button", async () => {
    renderWithProviders(<TransactionsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /transactions/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
  });

  it("displays transactions list after loading", async () => {
    renderWithProviders(<TransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText(/coffee/i)).toBeInTheDocument();
      expect(screen.getByText(/salary/i)).toBeInTheDocument();
    });
  });

  it("shows transaction type badges", async () => {
    renderWithProviders(<TransactionsPage />);

    await waitFor(() => {
      expect(screen.getByText("expense")).toBeInTheDocument();
      expect(screen.getByText("income")).toBeInTheDocument();
    });
  });

  it("opens add transaction form when clicking add button", async () => {
    renderWithProviders(<TransactionsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/what was this for/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });
  });

  it("can fill and submit transaction form", async () => {
    renderWithProviders(<TransactionsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    // Wait for form to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    // Fill form using placeholders
    await user.type(screen.getByPlaceholderText("0.00"), "50.00");
    await user.type(screen.getByPlaceholderText(/what was this for/i), "Test expense");

    // Submit
    await user.click(screen.getByRole("button", { name: /save/i }));

    // Form should close after successful submission
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    });
  });

  it("can close form with cancel button", async () => {
    renderWithProviders(<TransactionsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add transaction/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add transaction/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons for each transaction", async () => {
    renderWithProviders(<TransactionsPage />);

    await waitFor(() => {
      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      
      expect(editButtons.length).toBeGreaterThan(0);
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });
});
