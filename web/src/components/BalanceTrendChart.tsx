import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../lib/currency";

interface TrendPoint {
  date: string;
  income: number;
  expenses: number;
  balance: number;
}

interface BalanceTrendChartProps {
  data: TrendPoint[];
  currency: string;
  isLoading?: boolean;
}

export function BalanceTrendChart({ data, currency, isLoading }: BalanceTrendChartProps) {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No trend data available
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Custom tooltip
  const CustomTooltip = ({ 
    active, 
    payload, 
    label 
  }: { 
    active?: boolean; 
    payload?: Array<{ value: number }>; 
    label?: string;
  }) => {
    if (!active || !payload || !payload.length || !label) return null;

    const balance = payload[0].value;
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString("en-US", { 
      weekday: "short",
      month: "short", 
      day: "numeric",
      year: "numeric",
    });

    return (
      <div className="bg-white px-3 py-2 shadow-lg rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500 mb-1">{formattedDate}</p>
        <p className={`font-semibold ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {formatCurrency(balance, currency)}
        </p>
      </div>
    );
  };

  // Determine min/max for better Y-axis display
  const balances = data.map(d => d.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const padding = (maxBalance - minBalance) * 0.1 || 100;
  const yMin = Math.floor((minBalance - padding) / 100) * 100;
  const yMax = Math.ceil((maxBalance + padding) / 100) * 100;

  // Determine if balance is generally positive or negative for gradient color
  const avgBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
  const gradientColor = avgBalance >= 0 ? "#10B981" : "#EF4444"; // emerald or red

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: "#6B7280" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(value) => {
              if (Math.abs(value) >= 1000000) {
                return `${(value / 1000000).toFixed(1)}M`;
              }
              if (Math.abs(value) >= 1000) {
                return `${(value / 1000).toFixed(0)}K`;
              }
              return value.toString();
            }}
            tick={{ fontSize: 12, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={gradientColor}
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
