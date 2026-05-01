"use client";

import Link from "next/link";
import type { CreditCardStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function CreditCardSummary({ cards }: { cards: CreditCardStatus[] }) {
  const totalOwed = cards.reduce((s, c) => s + Number(c.amount_owed), 0);

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted">Credit Cards</h2>
        <Link
          href="/accounts"
          className="text-xs text-brand hover:underline"
        >
          Manage →
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted">
        Total owed:{" "}
        <span className="tabular-nums font-medium text-danger">
          {formatCurrency(totalOwed)}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((cc) => {
          const util = cc.utilization_pct ?? 0;
          const utilColor =
            util >= 80 ? "bg-danger" : util >= 30 ? "bg-warning" : "bg-brand";
          return (
            <div
              key={cc.id}
              className="rounded-lg border border-surface-3 bg-surface-2 p-4"
            >
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium">{cc.name}</p>
                <p className="text-xs text-warning tabular-nums">
                  Due {formatDate(cc.due_date, "MMM d")}
                </p>
              </div>
              <p className="mt-2 text-lg font-semibold tabular-nums text-danger">
                {formatCurrency(cc.amount_owed)}
              </p>
              {cc.credit_limit && (
                <>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-surface-4">
                    <div
                      className={`h-full rounded-full ${utilColor}`}
                      style={{ width: `${Math.min(util, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    {util.toFixed(1)}% used · {formatCurrency(cc.cycle_spending)}{" "}
                    this cycle
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
