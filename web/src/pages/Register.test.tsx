import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { resetAuthState } from "../test/mocks/handlers";
import { RegisterPage } from "./Register";

describe("RegisterPage", () => {
  beforeEach(() => {
    resetAuthState();
  });

  it("renders registration form", async () => {
    renderWithProviders(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/john doe/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    });
  });

  it("shows password requirements hint", async () => {
    renderWithProviders(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("submits form with valid data", async () => {
    renderWithProviders(<RegisterPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/john doe/i), "New User");
    await user.type(screen.getByPlaceholderText(/you@example.com/i), "new@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    
    const button = screen.getByRole("button", { name: /create account/i });
    expect(button).not.toBeDisabled();
    await user.click(button);
  });

  it("has link to login page", async () => {
    renderWithProviders(<RegisterPage />);

    await waitFor(() => {
      expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    });
  });
});
