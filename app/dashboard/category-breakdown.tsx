"use client";

import type { MonthlyCategoryTotal } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function CategoryBreakdown({ data }: { data: MonthlyCategoryTotal[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No categories yet
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="mt-4 space-y-3">
      {data.map((cat) => {
        const pct = total > 0 ? (cat.total / total) * 100 : 0;
        return (
          <div key={cat.category}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span>{cat.icon}</span>
                <span>{cat.category}</span>
              </span>
              <span className="tabular-nums font-medium">
                {formatCurrency(cat.total)}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: cat.color ?? "#71717a",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
