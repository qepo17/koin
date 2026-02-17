import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { setAuthState, resetAuthState } from "../test/mocks/handlers";
import { CategoriesPage } from "./Categories";

describe("CategoriesPage", () => {
  beforeEach(() => {
    resetAuthState();
    setAuthState(true);
  });

  it("renders page title and add button", async () => {
    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /categories/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add category/i })).toBeInTheDocument();
  });

  it("displays categories after loading", async () => {
    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByText(/food & dining/i)).toBeInTheDocument();
      expect(screen.getByText(/restaurants and groceries/i)).toBeInTheDocument();
    });
  });

  it("opens add category form when clicking add button", async () => {
    renderWithProviders(<CategoriesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add category/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add category/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/food & dining/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });
  });

  it("can fill and submit category form", async () => {
    renderWithProviders(<CategoriesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add category/i })).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole("button", { name: /add category/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/food & dining/i)).toBeInTheDocument();
    });

    // Fill form using placeholders
    await user.type(screen.getByPlaceholderText(/food & dining/i), "Entertainment");
    await user.type(screen.getByPlaceholderText(/optional description/i), "Movies and games");

    // Submit
    await user.click(screen.getByRole("button", { name: /save/i }));

    // Form should close
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
    });
  });

  it("shows color picker in form", async () => {
    renderWithProviders(<CategoriesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add category/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add category/i }));

    await waitFor(() => {
      expect(screen.getByText(/color/i)).toBeInTheDocument();
      // Should have color buttons
      const colorButtons = screen.getAllByRole("button").filter(
        (btn) => btn.className.includes("rounded-full") && btn.style.backgroundColor
      );
      expect(colorButtons.length).toBeGreaterThan(0);
    });
  });

  it("shows edit and delete buttons for each category", async () => {
    renderWithProviders(<CategoriesPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });
});
