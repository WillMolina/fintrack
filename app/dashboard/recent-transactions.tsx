"use client";

import type { Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function RecentTransactions({
  transactions,
}: {
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted">
        No transactions yet
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
            <th className="pb-3 pr-4">Date</th>
            <th className="pb-3 pr-4">Description</th>
            <th className="pb-3 pr-4">Category</th>
            <th className="pb-3 pr-4">Account</th>
            <th className="pb-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-3">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-surface-2 transition-colors">
              <td className="py-3 pr-4 tabular-nums text-muted">
                {formatDate(tx.date, "MMM d")}
              </td>
              <td className="py-3 pr-4">
                <div>{tx.description}</div>
                {tx.merchant && (
                  <div className="text-xs text-muted">{tx.merchant}</div>
                )}
              </td>
              <td className="py-3 pr-4">
                {tx.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs">
                    <span>{tx.category.icon}</span>
                    {tx.category.name}
                  </span>
                )}
              </td>
              <td className="py-3 pr-4 text-muted">
                {tx.account?.name ?? "—"}
              </td>
              <td
                className={`py-3 text-right tabular-nums font-medium ${
                  tx.amount > 0 ? "text-danger" : "text-brand"
                }`}
              >
                {tx.amount > 0 ? "-" : "+"}
                {formatCurrency(Math.abs(tx.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
