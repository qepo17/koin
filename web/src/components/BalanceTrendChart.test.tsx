import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceTrendChart } from "./BalanceTrendChart";

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

const mockData = [
  { date: "2026-01-01", income: 1000, expenses: 500, balance: 500 },
  { date: "2026-01-02", income: 200, expenses: 100, balance: 600 },
  { date: "2026-01-03", income: 300, expenses: 200, balance: 700 },
];

describe("BalanceTrendChart", () => {
  it("renders loading state", () => {
    render(
      <BalanceTrendChart
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
      <BalanceTrendChart
        data={[]}
        currency="USD"
        isLoading={false}
      />
    );

    expect(screen.getByText("No trend data available")).toBeInTheDocument();
  });

  it("renders chart with data", () => {
    const { container } = render(
      <BalanceTrendChart
        data={mockData}
        currency="USD"
        isLoading={false}
      />
    );

    // Chart should render
    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });

  it("renders with negative balances", () => {
    const negativeData = [
      { date: "2026-01-01", income: 100, expenses: 500, balance: -400 },
      { date: "2026-01-02", income: 50, expenses: 100, balance: -450 },
    ];

    const { container } = render(
      <BalanceTrendChart
        data={negativeData}
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
      <BalanceTrendChart
        data={singlePoint}
        currency="USD"
        isLoading={false}
      />
    );

    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });
});
