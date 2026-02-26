import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DateRangePicker, getDefaultDateRange, type DateRange } from "./DateRangePicker";

describe("DateRangePicker", () => {
  const mockOnChange = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default display", () => {
    render(
      <DateRangePicker
        value={{ from: "", to: "" }}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText("All time")).toBeInTheDocument();
  });

  it("opens dropdown when clicked", () => {
    render(
      <DateRangePicker
        value={{ from: "", to: "" }}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText("All time"));
    
    expect(screen.getByText("This month")).toBeInTheDocument();
    expect(screen.getByText("Last month")).toBeInTheDocument();
    expect(screen.getByText("Last 3 months")).toBeInTheDocument();
    expect(screen.getByText("Year to date")).toBeInTheDocument();
  });

  it("calls onChange with preset value", () => {
    render(
      <DateRangePicker
        value={{ from: "", to: "" }}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText("All time"));
    fireEvent.click(screen.getByText("Last month"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const call = mockOnChange.mock.calls[0][0] as DateRange;
    expect(call.from).toBeDefined();
    expect(call.to).toBeDefined();
  });

  it("shows custom range inputs", () => {
    render(
      <DateRangePicker
        value={{ from: "", to: "" }}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText("All time"));
    
    expect(screen.getByText("Custom range")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("applies custom date range", () => {
    render(
      <DateRangePicker
        value={{ from: "", to: "" }}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText("All time"));
    
    const fromInput = screen.getByLabelText("From");
    const toInput = screen.getByLabelText("To");
    
    fireEvent.change(fromInput, { target: { value: "2026-01-01" } });
    fireEvent.change(toInput, { target: { value: "2026-01-31" } });
    
    fireEvent.click(screen.getByText("Apply"));

    expect(mockOnChange).toHaveBeenCalledWith({
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("disables Apply button when dates are missing", () => {
    render(
      <DateRangePicker
        value={{ from: "", to: "" }}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText("All time"));
    
    const applyButton = screen.getByText("Apply");
    expect(applyButton).toBeDisabled();
  });

  it("displays custom date range in trigger", () => {
    render(
      <DateRangePicker
        value={{ from: "2026-01-15", to: "2026-02-15" }}
        onChange={mockOnChange}
      />
    );

    // Should show formatted date range
    expect(screen.getByText(/Jan 15, 2026/)).toBeInTheDocument();
  });

  it("highlights active preset", () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    render(
      <DateRangePicker
        value={{ 
          from: startOfMonth.toISOString().split("T")[0], 
          to: today.toISOString().split("T")[0] 
        }}
        onChange={mockOnChange}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button"));
    
    // "This month" button in the dropdown should have active styling
    const buttons = screen.getAllByText("This month");
    // The second one is in the dropdown (first is in the trigger display)
    const thisMonthButton = buttons.length > 1 ? buttons[1] : buttons[0];
    expect(thisMonthButton).toHaveClass("bg-emerald-100");
  });

  it("closes dropdown when clicking outside", () => {
    render(
      <div>
        <DateRangePicker
          value={{ from: "", to: "" }}
          onChange={mockOnChange}
        />
        <div data-testid="outside">Outside</div>
      </div>
    );

    // Open dropdown
    fireEvent.click(screen.getByText("All time"));
    expect(screen.getByText("Custom range")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(screen.getByTestId("outside"));
    
    // Dropdown should be closed
    expect(screen.queryByText("Custom range")).not.toBeInTheDocument();
  });
});

describe("getDefaultDateRange", () => {
  it("returns this month range", () => {
    const range = getDefaultDateRange();
    
    expect(range.from).toBeDefined();
    expect(range.to).toBeDefined();
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // "from" should be the 1st of the month
    expect(range.from.endsWith("-01")).toBe(true);
  });
});
