import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryDonutChart } from "./CategoryDonutChart";

// Mock recharts ResponsiveContainer to render children directly
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
  { categoryId: "1", categoryName: "Food", total: "500.00", count: 10 },
  { categoryId: "2", categoryName: "Transport", total: "300.00", count: 5 },
  { categoryId: "3", categoryName: "Entertainment", total: "200.00", count: 3 },
];

describe("CategoryDonutChart", () => {
  it("renders loading state", () => {
    render(
      <CategoryDonutChart
        data={[]}
        currency="USD"
        isLoading={true}
      />
    );

    // Should show loading spinner (animated element)
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(
      <CategoryDonutChart
        data={[]}
        currency="USD"
        isLoading={false}
      />
    );

    expect(screen.getByText("No spending data available")).toBeInTheDocument();
  });

  it("renders chart container with data", () => {
    const { container } = render(
      <CategoryDonutChart
        data={mockData}
        currency="USD"
        isLoading={false}
      />
    );

    // Chart should render (recharts creates SVG elements)
    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });

  it("renders without crashing with null category name", () => {
    const dataWithNull = [
      { categoryId: null, categoryName: null, total: "100.00", count: 2 },
    ];

    const { container } = render(
      <CategoryDonutChart
        data={dataWithNull}
        currency="USD"
        isLoading={false}
      />
    );

    // Should render chart container
    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });

  it("renders with many categories without crashing", () => {
    const manyCategories = [
      { categoryId: "1", categoryName: "Cat1", total: "100.00", count: 1 },
      { categoryId: "2", categoryName: "Cat2", total: "90.00", count: 1 },
      { categoryId: "3", categoryName: "Cat3", total: "80.00", count: 1 },
      { categoryId: "4", categoryName: "Cat4", total: "70.00", count: 1 },
      { categoryId: "5", categoryName: "Cat5", total: "60.00", count: 1 },
      { categoryId: "6", categoryName: "Cat6", total: "50.00", count: 1 },
      { categoryId: "7", categoryName: "Cat7", total: "40.00", count: 1 },
      { categoryId: "8", categoryName: "Cat8", total: "30.00", count: 1 },
    ];

    const { container } = render(
      <CategoryDonutChart
        data={manyCategories}
        currency="USD"
        isLoading={false}
      />
    );

    // Should render chart container (categories are grouped internally)
    expect(container.querySelector(".recharts-wrapper")).toBeInTheDocument();
  });
});
