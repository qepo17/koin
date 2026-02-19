import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { setAuthState, resetAuthState } from "../test/mocks/handlers";
import { SettingsPage } from "./Settings";

describe("SettingsPage", () => {
  beforeEach(() => {
    resetAuthState();
    setAuthState(true);
  });

  it("renders page title", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
    });
  });

  it("displays preferences section with currency selector", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /preferences/i })).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("shows current currency value", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      const select = screen.getByRole("combobox");
      expect(select).toHaveValue("USD");
    });
  });

  it("can change currency", async () => {
    renderWithProviders(<SettingsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "EUR");

    await waitFor(() => {
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });

  it("displays currency options with symbols", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    const options = select.querySelectorAll("option");
    
    // Check that we have multiple currency options
    expect(options.length).toBeGreaterThan(10);
    
    // Check some specific currencies
    expect(screen.getByRole("option", { name: /USD.*US Dollar/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /EUR.*Euro/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /IDR.*Indonesian Rupiah/i })).toBeInTheDocument();
  });

  it("displays AI agent integration section", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /ai agent integration/i })).toBeInTheDocument();
    });
  });

  it("shows download SKILL.md button", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download skill\.md/i })).toBeInTheDocument();
    });
  });

  it("displays API tokens section with create button", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /api tokens/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create token/i })).toBeInTheDocument();
    });
  });

  it("can open create token form", async () => {
    renderWithProviders(<SettingsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create token/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /create token/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/my ai agent/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
    });
  });

  it("can create a token and see it displayed", async () => {
    renderWithProviders(<SettingsPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create token/i })).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole("button", { name: /create token/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/my ai agent/i)).toBeInTheDocument();
    });

    // Fill and submit
    await user.type(screen.getByPlaceholderText(/my ai agent/i), "Test Agent");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    // Should show the new token
    await waitFor(() => {
      expect(screen.getByText(/token created/i)).toBeInTheDocument();
      expect(screen.getByText(/copy this token now/i)).toBeInTheDocument();
    });
  });

  it("shows how to use section", async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /how to use/i })).toBeInTheDocument();
      // Multiple elements contain KOIN_API_TOKEN, use getAllByText
      const tokenElements = screen.getAllByText(/koin_api_token/i);
      expect(tokenElements.length).toBeGreaterThan(0);
    });
  });
});
