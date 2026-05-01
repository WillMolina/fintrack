"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { MonthlySummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function SpendingChart({ data }: { data: MonthlySummary[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No data yet — add some transactions!
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: format(parseISO(d.month), "MMM"),
    expenses: d.total_expenses,
    income: d.total_income,
  }));

  return (
    <div className="mt-4 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#71717a", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#71717a", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: "13px",
            }}
            formatter={(value: number) => [formatCurrency(value)]}
            labelStyle={{ color: "#71717a" }}
          />
          <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
