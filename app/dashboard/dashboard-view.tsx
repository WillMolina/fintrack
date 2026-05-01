"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { differenceInDays, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";
import type { Account, BillingCycleSummary, MonthlyCategoryTotal } from "@/lib/types";
import { formatCurrency, formatDate, CHART_COLORS } from "@/lib/utils";

type MonthlyTrend = { month: string; total_expenses: number; total_income: number };

export function DashboardView({
  monthStr,
  monthLabel,
  prevMonth,
  nextMonth,
  savingsBalance,
  savingsAccountName,
  totalCCDebt,
  earliestCycleEnd,
  monthExpenses,
  monthIncome,
  trendData,
  ccCycles,
  ccAccounts,
  topCategories,
}: {
  monthStr: string;
  monthLabel: string;
  prevMonth: string;
  nextMonth: string;
  savingsBalance: number;
  savingsAccountName: string;
  totalCCDebt: number;
  earliestCycleEnd: string | null;
  monthExpenses: number;
  monthIncome: number;
  trendData: MonthlyTrend[];
  ccCycles: BillingCycleSummary[];
  ccAccounts: Account[];
  topCategories: MonthlyCategoryTotal[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const monthInputRef = useRef<HTMLInputElement>(null);

  const monthBalance = monthIncome - monthExpenses;

  const daysLeft = earliestCycleEnd
    ? differenceInDays(parseISO(earliestCycleEnd), new Date())
    : null;

  const maxCategory = Math.max(...topCategories.map((c) => c.total), 1);

  const chartData = trendData.map((d) => ({
    month: format(parseISO(d.month), "MMM"),
    expenses: Number(d.total_expenses),
    income: Number(d.total_income),
  }));

  const statusStyle: Record<string, string> = {
    open: "text-brand bg-brand/10",
    closed: "text-warning bg-warning/10",
    paid: "text-muted bg-surface-3",
  };

  const handleMonthClick = () => {
    try {
      monthInputRef.current?.showPicker();
    } catch {
      monthInputRef.current?.click();
    }
  };

  return (
    <div className="pb-28">
      {/* Header + Month Nav */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {/*<h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>*/}
        <div className="flex items-center gap-2">
          <Link
            href={{ pathname, query: { month: prevMonth } }}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            ←
          </Link>
          <button
            onClick={handleMonthClick}
            className="min-w-[150px] rounded-lg border border-surface-4 px-3 py-1.5 text-center text-sm font-medium hover:border-brand hover:text-brand transition-colors"
          >
            {monthLabel}
          </button>
          <input
            ref={monthInputRef}
            type="month"
            value={monthStr}
            onChange={(e) => {
              if (e.target.value) router.push(`${pathname}?month=${e.target.value}`);
            }}
            className="sr-only"
          />
          <Link
            href={{ pathname, query: { month: nextMonth } }}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            →
          </Link>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Ahorros Davibank */}
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {savingsAccountName}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-brand">
            {formatCurrency(savingsBalance)}
          </p>
          <p className="mt-1.5 text-xs text-muted">Balance al cierre de {monthLabel}</p>
        </div>

        {/* CC Open Cycle Debt */}
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Deuda en Tarjetas
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-danger">
            {formatCurrency(totalCCDebt)}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {daysLeft !== null ? (
              daysLeft > 0 ? (
                <>
                  <span className="font-medium text-warning">{daysLeft}d</span>{" "}
                  para el cierre del ciclo · {formatDate(earliestCycleEnd!, "MMM d")}
                </>
              ) : (
                <span className="text-danger">Ciclo vencido — ciérralo</span>
              )
            ) : (
              "Sin ciclos abiertos"
            )}
          </p>
        </div>

        {/* Monthly Income / Expenses / Balance */}
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Resumen de {monthLabel}
          </p>
          <p
            className={`mt-2 text-3xl font-bold tabular-nums ${
              monthBalance >= 0 ? "text-brand" : "text-danger"
            }`}
          >
            {monthBalance >= 0 ? "+" : "-"}
            {formatCurrency(Math.abs(monthBalance))}
          </p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
            <span>
              <span className="text-danger">↓</span>{" "}
              <span className="tabular-nums">{formatCurrency(monthExpenses)}</span>
            </span>
            <span>
              <span className="text-brand">↑</span>{" "}
              <span className="tabular-nums">{formatCurrency(monthIncome)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Spending Trend + CC Cycles */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Spending Trend Chart */}
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <h2 className="text-sm font-medium text-muted">Tendencia de Gastos</h2>
          {chartData.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted">
              Sin datos aún
            </div>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
                  <Line dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Gastos" />
                  <Line dataKey="income" stroke="#18efc6" strokeWidth={2} dot={false} name="Ingresos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* CC Cycles Comparison */}
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <h2 className="text-sm font-medium text-muted">
            Tarjetas de Crédito — Últimos 3 Ciclos
          </h2>
          {ccAccounts.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted">
              Sin tarjetas de crédito configuradas
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {ccAccounts.map((cc) => {
                const cycles = ccCycles
                  .filter((c) => c.account_id === cc.id)
                  .slice(0, 3);
                return (
                  <div key={cc.id}>
                    <p className="text-xs font-semibold text-white">{cc.name}</p>
                    <div className="mt-2 space-y-1.5">
                      {cycles.length === 0 ? (
                        <p className="text-xs text-muted">Sin ciclos aún</p>
                      ) : (
                        cycles.map((cycle, i) => {
                          const prevCycle = cycles[i + 1];
                          const pct =
                            prevCycle && Number(prevCycle.cycle_spending) > 0
                              ? ((Number(cycle.cycle_spending) -
                                  Number(prevCycle.cycle_spending)) /
                                  Number(prevCycle.cycle_spending)) *
                                100
                              : null;
                          return (
                            <div
                              key={cycle.id}
                              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2"
                            >
                              <span className="text-xs tabular-nums text-muted">
                                {formatDate(cycle.cycle_start, "MMM d")} –{" "}
                                {formatDate(cycle.cycle_end, "MMM d")}
                              </span>
                              <div className="flex items-center gap-2">
                                {pct !== null && (
                                  <span
                                    className={`text-xs tabular-nums ${
                                      pct > 0 ? "text-danger" : "text-brand"
                                    }`}
                                  >
                                    {pct > 0 ? "+" : ""}
                                    {pct.toFixed(0)}%
                                  </span>
                                )}
                                <span className="text-xs font-semibold tabular-nums text-danger">
                                  {formatCurrency(Number(cycle.cycle_spending))}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-xs ${
                                    statusStyle[cycle.status] ?? statusStyle.open
                                  }`}
                                >
                                  {cycle.status}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 6 Categories */}
      <div className="mt-6 rounded-xl border border-surface-3 bg-surface-1 p-5">
        <h2 className="text-sm font-medium text-muted">Gastos por Categoría</h2>
        {topCategories.length === 0 ? (
          <div className="mt-4 py-8 text-center text-sm text-muted">
            Sin datos de categorías para este mes
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topCategories.map((cat, i) => (
              <div key={cat.category} className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate text-xs font-medium">
                    {cat.icon && <span>{cat.icon}</span>}
                    <span className="truncate">{cat.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-danger">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(cat.total / maxCategory) * 100}%`,
                      backgroundColor: cat.color ?? CHART_COLORS[i] ?? "#71717a",
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {cat.tx_count} transaction{cat.tx_count !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
