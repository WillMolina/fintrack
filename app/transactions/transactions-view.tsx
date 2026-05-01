"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Transaction, Category, Account } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AddTransactionButton } from "@/components/ui/add-transaction-button";
import { AddTransactionModal } from "@/components/ui/add-transaction-modal";
import { useState } from "react";

export function TransactionsView({
  transactions,
  categories,
  accounts,
  monthLabel,
  monthStr,
  prevMonth,
  nextMonth,
  filters,
  totals,
  monthlyAccountBalance,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  monthLabel: string;
  monthStr: string;
  prevMonth: string;
  nextMonth: string;
  filters: { category: string; account: string; type: string; sort: string };
  totals: { expenses: number; income: number };
  monthlyAccountBalance: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set("month", monthStr);
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    setDeleting(id);
    await supabase.from("transactions").delete().eq("id", id);
    setDeleting(null);
    router.refresh();
  };

  const hasActiveFilters =
    filters.category || filters.account || filters.type !== "all" || filters.sort !== "date_desc";

  const inputClass =
    "rounded-lg border border-surface-4 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transacciones
          </h1>
          <p className="mt-1 text-sm text-muted">
            Todos tus gastos e ingresos registrados
          </p>
        </div>
        <AddTransactionButton variant="primary" />
      </div>

      {/* Month navigation + summary */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-surface-3 bg-surface-1 p-4">
        <div className="flex items-center gap-2">
          <Link
            href={{
              pathname,
              query: { ...Object.fromEntries(searchParams), month: prevMonth },
            }}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            ←
          </Link>
          <h2 className="min-w-[180px] text-center font-medium">
            {monthLabel}
          </h2>
          <Link
            href={{
              pathname,
              query: { ...Object.fromEntries(searchParams), month: nextMonth },
            }}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            →
          </Link>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-muted">Gastos </span>
            <span className="tabular-nums font-medium text-danger">
              {formatCurrency(totals.expenses)}
            </span>
          </div>
          <div>
            <span className="text-muted">Ingresos </span>
            <span className="tabular-nums font-medium text-brand">
              {formatCurrency(totals.income)}
            </span>
          </div>
          <div>
            <span className="text-muted">Balance </span>
            <span className={`tabular-nums font-medium ${totals.income - totals.expenses >= 0 ? "text-brand" : "text-danger"}`}>
              {totals.income - totals.expenses >= 0 ? "+" : "-"}
              {formatCurrency(Math.abs(totals.income - totals.expenses))}
            </span>
          </div>
          <div>
            <span className="text-muted">Cuentas </span>
            <span className={`tabular-nums font-medium ${monthlyAccountBalance >= 0 ? "text-brand" : "text-danger"}`}>
              {formatCurrency(monthlyAccountBalance)}
            </span>
          </div>
          <div>
            <span className="text-muted">Cantidad </span>
            <span className="tabular-nums font-medium">
              {transactions.length}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={filters.type}
          onChange={(e) => updateParam("type", e.target.value === "all" ? "" : e.target.value)}
          className={inputClass}
        >
          <option value="all">Todos los tipos</option>
          <option value="expenses">Solo gastos</option>
          <option value="income">Solo ingresos</option>
          <option value="credit">Solo tarjeta de crédito</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => updateParam("category", e.target.value)}
          className={inputClass}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        <select
          value={filters.account}
          onChange={(e) => updateParam("account", e.target.value)}
          className={inputClass}
        >
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.type === "credit_card" ? "💳" : "🏦"} {a.name}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => updateParam("sort", e.target.value === "date_desc" ? "" : e.target.value)}
          className={inputClass}
        >
          <option value="date_desc">Más reciente primero</option>
          <option value="date_asc">Más antiguo primero</option>
          <option value="amount_desc">Mayor monto</option>
          <option value="amount_asc">Menor monto</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Transaction Table */}
      <div className="mt-4">
        {transactions.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-surface-3 bg-surface-1 text-sm text-muted">
            No hay transacciones que coincidan con los filtros
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Descripción</th>
                    <th className="px-5 py-3">Categoría</th>
                    <th className="px-5 py-3">Cuenta</th>
                    <th className="px-5 py-3">TC</th>
                    <th className="px-5 py-3">Origen</th>
                    <th className="px-5 py-3 text-right">Monto</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3">
                  {transactions.map((tx) => {
                    const isCC = tx.account?.type === "credit_card";
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-surface-2 transition-colors"
                      >
                        <td className="px-5 py-3 tabular-nums text-muted whitespace-nowrap">
                          {formatDate(tx.date, "MMM d")}
                        </td>
                        <td className="px-5 py-3">
                          <div>{tx.description}</div>
                          {tx.merchant && (
                            <div className="text-xs text-muted">
                              {tx.merchant}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {tx.category ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs whitespace-nowrap">
                              <span>{tx.category.icon}</span>
                              {tx.category.name}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted whitespace-nowrap">
                          {tx.account?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          {isCC ? (
                            <div className="flex items-center gap-1.5" title={
                              tx.billing_cycle
                                ? `Cycle ${formatDate(tx.billing_cycle.cycle_start, "MMM d")} – ${formatDate(tx.billing_cycle.cycle_end, "MMM d")} (${tx.billing_cycle.status})`
                                : "Credit card"
                            }>
                              <span>💳</span>
                              {tx.billing_cycle && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  tx.billing_cycle.status === "open"
                                    ? "bg-brand/10 text-brand"
                                    : tx.billing_cycle.status === "closed"
                                      ? "bg-warning/10 text-warning"
                                      : "bg-muted/10 text-muted"
                                }`}>
                                  {tx.billing_cycle.status}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              tx.source === "webhook"
                                ? "bg-blue-500/10 text-blue-400"
                                : tx.source === "import"
                                  ? "bg-purple-500/10 text-purple-400"
                                  : "bg-surface-3 text-muted"
                            }`}
                          >
                            {tx.source}
                          </span>
                        </td>
                        <td
                          className={`px-5 py-3 text-right tabular-nums font-medium whitespace-nowrap ${
                            tx.amount > 0 ? "text-danger" : "text-brand"
                          }`}
                        >
                          {tx.amount > 0 ? "-" : "+"}
                          {formatCurrency(Math.abs(tx.amount))}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingTx(tx)}
                              className="rounded p-1 text-muted transition-colors hover:bg-surface-3 hover:text-white"
                              title="Editar"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDelete(tx.id)}
                              disabled={deleting === tx.id}
                              className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                              title="Eliminar"
                            >
                              {deleting === tx.id ? "…" : "✕"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <AddTransactionModal
        open={editingTx !== null}
        onClose={() => setEditingTx(null)}
        categories={categories}
        accounts={accounts}
        transaction={editingTx ?? undefined}
      />
    </div>
  );
}
