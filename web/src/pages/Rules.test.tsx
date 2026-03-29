import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { setAuthState, resetAuthState } from "../test/mocks/handlers";
import { RulesPage } from "./Rules";

describe("RulesPage", () => {
  beforeEach(() => {
    resetAuthState();
    setAuthState(true);
  });

  it("renders page title and add button", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /rules/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
  });

  it("displays rules after loading", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });
    expect(screen.getByText("Large expenses")).toBeInTheDocument();
  });

  it("shows category name for each rule", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Food & Dining").length).toBeGreaterThan(0);
  });

  it("shows human-readable conditions", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText(/description contains "grab"/i)).toBeInTheDocument();
    });
    // Amount condition with gt operator
    expect(screen.getByText((content) => content.includes("Amount") && content.includes("500"))).toBeInTheDocument();
  });

  it("shows priority badge and match count", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("Priority: 10")).toBeInTheDocument();
    });
    expect(screen.getByText(/12 match/)).toBeInTheDocument();
  });

  it("opens add rule form when clicking add button", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByText("Add Rule", { selector: "h2" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/grab rides/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });
  });

  it("shows category dropdown in form", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByText("Select category...")).toBeInTheDocument();
    });
  });

  it("shows condition builder with field and operator selectors", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      // The condition builder should have Description option selected and Contains operator
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Value...")).toBeInTheDocument();
    });
  });

  it("can add and remove conditions", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByText("+ Add condition")).toBeInTheDocument();
    });

    // Add a second condition
    await user.click(screen.getByText("+ Add condition"));

    await waitFor(() => {
      const valueInputs = screen.getAllByPlaceholderText("Value...");
      expect(valueInputs.length).toBe(2);
    });

    // Remove buttons should appear
    const removeButtons = screen.getAllByTitle("Remove condition");
    expect(removeButtons.length).toBe(2);

    await user.click(removeButtons[1]);

    await waitFor(() => {
      const valueInputs = screen.getAllByPlaceholderText("Value...");
      expect(valueInputs.length).toBe(1);
    });
  });

  it("shows negate and case-sensitive checkboxes for description conditions", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/negate/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/case sensitive/i)).toBeInTheDocument();
    });
  });

  it("shows between inputs for amount between operator", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      // Find the condition builder area
      expect(screen.getByText("Conditions")).toBeInTheDocument();
    });

    // Find the field selector within the condition area and switch to amount
    const conditionArea = screen.getByText("Conditions").closest("div")!;
    const selects = conditionArea.querySelectorAll("select");
    // First select in conditions area is the field selector
    const fieldSelect = selects[0] as HTMLSelectElement;
    await user.selectOptions(fieldSelect, "amount");

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Amount...")).toBeInTheDocument();
    });

    // Now find the operator select and choose "between"
    const updatedSelects = screen.getByText("Conditions").closest("div")!.querySelectorAll("select");
    // After switching to amount, the operator select should be the second one in the condition row
    const operatorSelect = Array.from(updatedSelects).find(
      (s) => Array.from(s.options).some((o) => o.value === "between")
    ) as HTMLSelectElement;
    await user.selectOptions(operatorSelect, "between");

    await waitFor(() => {
      expect(screen.getByText("and")).toBeInTheDocument();
    });
  });

  it("shows enabled toggle and priority in form", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/enabled/i)).toBeInTheDocument();
      expect(screen.getByText(/higher priority rules/i)).toBeInTheDocument();
    });
  });

  it("can close form with cancel button", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Add Rule", { selector: "h2" })).not.toBeInTheDocument();
    });
  });

  it("can fill and submit rule form", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add rule/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/grab rides/i)).toBeInTheDocument();
    });

    // Fill name
    await user.type(screen.getByPlaceholderText(/grab rides/i), "Test Rule");

    // Select category - find the select that has "Select category..." option
    const categorySelect = screen.getByText("Select category...").closest("select") as HTMLSelectElement;
    await user.selectOptions(categorySelect, "cat-1");

    // Fill condition value
    await user.type(screen.getByPlaceholderText("Value..."), "test");

    // Submit
    await user.click(screen.getByRole("button", { name: /save/i }));

    // Form should close
    await waitFor(() => {
      expect(screen.queryByText("Add Rule", { selector: "h2" })).not.toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons for each rule", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });

    expect(editButtons.length).toBeGreaterThanOrEqual(2);
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("shows apply and test buttons for each rule", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });

    const applyButtons = screen.getAllByRole("button", { name: /^apply$/i });
    const testButtons = screen.getAllByRole("button", { name: /^test$/i });

    expect(applyButtons.length).toBeGreaterThanOrEqual(2);
    expect(testButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("opens test modal when clicking test button", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });

    const testButtons = screen.getAllByRole("button", { name: /^test$/i });
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Test Rule", { selector: "h2" })).toBeInTheDocument();
      expect(screen.getByText(/testing: auto-categorize grab/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/grab ride to office/i)).toBeInTheDocument();
    });
  });

  it("can submit test and see result", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });

    const testButtons = screen.getAllByRole("button", { name: /^test$/i });
    await user.click(testButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/grab ride to office/i)).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/grab ride to office/i), "Grab ride");
    await user.type(screen.getByPlaceholderText(/50000/i), "25000");

    // Find the Test button inside the modal (submit button)
    const modal = screen.getByText("Test Rule", { selector: "h2" }).closest(".fixed");
    const modalTestButton = modal!.querySelector("button[type='submit']") as HTMLElement;
    await user.click(modalTestButton);

    await waitFor(() => {
      expect(screen.getByText(/match! this transaction would be categorized/i)).toBeInTheDocument();
    });
  });

  it("shows enabled/disabled toggle per rule", async () => {
    renderWithProviders(<RulesPage />);

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });

    const toggleButtons = screen.getAllByTitle(/enable|disable/i);
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("opens edit form when clicking edit button", async () => {
    renderWithProviders(<RulesPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText("Auto-categorize Grab")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Edit Rule", { selector: "h2" })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Auto-categorize Grab")).toBeInTheDocument();
    });
  });
});
