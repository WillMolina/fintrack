"use client";

import { formatCurrency } from "@/lib/utils";

export function CashFlowSummary({
  cashIn,
  cashOut,
  ccPayments,
  netWorth,
}: {
  cashIn: number;
  cashOut: number;
  ccPayments: number;
  netWorth: number;
}) {
  const net = cashIn - cashOut;
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Cash In" value={formatCurrency(cashIn)} accent="text-brand" />
      <Card
        label="Cash Out"
        value={formatCurrency(cashOut)}
        sub={`Includes ${formatCurrency(ccPayments)} CC payments`}
        accent="text-danger"
      />
      <Card
        label="Net Cash"
        value={formatCurrency(Math.abs(net))}
        sub={net >= 0 ? "Saved" : "Spent more than earned"}
        accent={net >= 0 ? "text-brand" : "text-danger"}
      />
      <Card
        label="Net Worth"
        value={formatCurrency(netWorth)}
        accent={netWorth >= 0 ? "text-white" : "text-danger"}
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${accent}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
