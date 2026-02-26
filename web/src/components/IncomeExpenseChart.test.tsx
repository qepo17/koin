import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncomeExpenseChart } from "./IncomeExpenseChart";

// Mock recharts ResponsiveContainer
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 400 }}>{children}</div>
    ),
  };
});

const mockMonthlyData = [
  { date: "2026-01-01", income: 5000, expenses: 3000, balance: 2000 },
  { date: "2026-02-01", income: 4500, expenses: 3500, balance: 3000 },
  { date: "2026-03-01", income: 6000, expenses: 4000, balance: 5000 },
];

const mockDailyData = [
  { date: "2026-01-15", income: 100, expenses: 50, balance: 50 },
  { date: "2026-01-16", income: 200, expenses: 80, balance: 170 },
  { date: "2026-01-17", income: 150, expenses: 100, balance: 220 },
];

describe("IncomeExpenseChart", () => {
  it("renders loading state", () => {
    render(
      <IncomeExpenseChart
        data={[]}
        currency="USD"
        isLoading={true}
      />
    );

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(
      <IncomeExpenseChart
        data={[]}
        currency="USD"
        isLoading={false}
      />
    );

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders chart with monthly data", () => {
    const { container } = render(
      <IncomeExpenseChart
        data={mockMonthlyData}
        currency="USD"
        isLoading={false}
      />
    );

    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });

  it("renders chart with daily data", () => {
    const { container } = render(
      <IncomeExpenseChart
        data={mockDailyData}
        currency="USD"
        isLoading={false}
      />
    );

    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });

  it("renders with single data point", () => {
    const singlePoint = [
      { date: "2026-01-01", income: 1000, expenses: 500, balance: 500 },
    ];

    const { container } = render(
      <IncomeExpenseChart
        data={singlePoint}
        currency="USD"
        isLoading={false}
      />
    );

    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });

  it("renders with zero values", () => {
    const zeroData = [
      { date: "2026-01-01", income: 0, expenses: 0, balance: 0 },
      { date: "2026-02-01", income: 0, expenses: 0, balance: 0 },
    ];

    const { container } = render(
      <IncomeExpenseChart
        data={zeroData}
        currency="USD"
        isLoading={false}
      />
    );

    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });
});
