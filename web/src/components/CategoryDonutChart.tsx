import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "../lib/currency";

interface CategoryData {
  categoryId: string | null;
  categoryName: string | null;
  total: string;
  count: number;
}

interface CategoryDonutChartProps {
  data: CategoryData[];
  currency: string;
  isLoading?: boolean;
}

// Color palette for categories
const COLORS = [
  "#10B981", // emerald-500
  "#3B82F6", // blue-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
];

const OTHER_COLOR = "#9CA3AF"; // gray-400

export function CategoryDonutChart({ data, currency, isLoading }: CategoryDonutChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-32 h-32 rounded-full border-4 border-gray-200 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No spending data available
      </div>
    );
  }

  // Process data: show top 6 categories, group rest as "Other"
  const sortedData = [...data].sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
  const topCategories = sortedData.slice(0, 6);
  const otherCategories = sortedData.slice(6);

  const chartData = topCategories.map((cat, index) => ({
    name: cat.categoryName || "Uncategorized",
    value: parseFloat(cat.total),
    color: COLORS[index % COLORS.length],
  }));

  // Add "Other" category if there are more than 6 categories
  if (otherCategories.length > 0) {
    const otherTotal = otherCategories.reduce((sum, cat) => sum + parseFloat(cat.total), 0);
    chartData.push({
      name: "Other",
      value: otherTotal,
      color: OTHER_COLOR,
    });
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; color: string } }> }) => {
    if (!active || !payload || !payload.length) return null;

    const { name, value, color } = payload[0].payload;
    const percentage = ((value / total) * 100).toFixed(1);

    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-medium text-gray-900">{name}</span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {formatCurrency(value, currency)} ({percentage}%)
        </div>
      </div>
    );
  };

  // Custom legend
  const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
    if (!payload) return null;

    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5 text-sm">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
