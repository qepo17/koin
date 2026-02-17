import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { resetAuthState } from "../test/mocks/handlers";
import { LoginPage } from "./Login";

describe("LoginPage", () => {
  beforeEach(() => {
    resetAuthState();
  });

  it("renders login form", async () => {
    renderWithProviders(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it("shows error for invalid credentials", async () => {
    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/you@example.com/i), "wrong@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    });
  });

  it("submits form with valid credentials", async () => {
    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/you@example.com/i), "test@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    
    // Verify we can click the submit button (form is valid)
    const button = screen.getByRole("button", { name: /sign in/i });
    expect(button).not.toBeDisabled();
    await user.click(button);
  });

  it("has link to register page", async () => {
    renderWithProviders(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    });
  });
});
