"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type {
  Account,
  BillingCycleSummary,
  Transaction,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState } from "react";

export function CreditCardCycleView({
  cards,
  selectedCard,
  cycles,
  selectedCycleId,
  transactions,
}: {
  cards: Account[];
  selectedCard: Account | null;
  cycles: BillingCycleSummary[];
  selectedCycleId: string | null;
  transactions: Transaction[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const supabase = createClient();
  const [closing, setClosing] = useState(false);

  const setQuery = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Reset cycle when card changes
    if (key === "card") next.delete("cycle");
    router.push(`${pathname}?${next.toString()}`);
  };

  const selectedCycle = cycles.find((c) => c.id === selectedCycleId);

  const handleCloseCycle = async () => {
    if (!selectedCycle || selectedCycle.status !== "open") return;
    if (!confirm("¿Cerrar este ciclo de facturación? Se marcará como estado de cuenta.")) return;
    setClosing(true);
    await supabase.rpc("close_billing_cycle", { p_cycle_id: selectedCycle.id });
    setClosing(false);
    router.refresh();
  };

  if (cards.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tarjetas de Crédito</h1>
        <div className="mt-6 rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
          Sin tarjetas de crédito. Agrega una en <Link href="/accounts" className="text-brand hover:underline">Cuentas</Link>.
        </div>
      </div>
    );
  }

  if (!selectedCard) return null;

  // Header math
  const utilization =
    selectedCard.credit_limit && selectedCard.credit_limit > 0
      ? (Number(selectedCard.balance) / Number(selectedCard.credit_limit)) * 100
      : 0;
  const utilColor =
    utilization >= 80 ? "bg-danger" : utilization >= 30 ? "bg-warning" : "bg-brand";

  // Cycle status indicator
  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: "bg-brand/10 text-brand border-brand/30",
      closed: "bg-warning/10 text-warning border-warning/30",
      paid: "bg-muted/10 text-muted border-muted/30",
    };
    return styles[status] ?? styles.open;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tarjetas de Crédito
          </h1>
          <p className="mt-1 text-sm text-muted">
            Ver transacciones por ciclo de facturación
          </p>
        </div>

        {/* Card selector */}
        <select
          value={selectedCard.id}
          onChange={(e) => setQuery("card", e.target.value)}
          className="rounded-lg border border-surface-4 bg-surface-2 px-4 py-2 text-sm text-white focus:border-brand focus:outline-none"
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              💳 {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Card-level summary header */}
      <div className="mt-6 rounded-xl border border-surface-3 bg-gradient-to-br from-surface-1 to-surface-2 p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <h2 className="text-xl font-semibold">{selectedCard.name}</h2>
            </div>
            <p className="mt-3 text-xs uppercase tracking-wider text-muted">
              Total Adeudado
            </p>
            <p className="text-4xl font-bold tabular-nums text-danger">
              {formatCurrency(Number(selectedCard.balance))}
            </p>
            {selectedCard.credit_limit && (
              <p className="mt-1 text-xs text-muted tabular-nums">
                of {formatCurrency(Number(selectedCard.credit_limit))} limit
              </p>
            )}
          </div>

          {/* Right-side stats */}
          <div className="flex flex-col items-end gap-3">
            {selectedCard.credit_limit && (
              <div className="w-64">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Utilización</span>
                  <span className="tabular-nums font-medium">
                    {utilization.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full transition-all ${utilColor}`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  Disponible:{" "}
                  <span className="text-white">
                    {formatCurrency(
                      Number(selectedCard.credit_limit) - Number(selectedCard.balance)
                    )}
                  </span>
                </p>
              </div>
            )}
            {selectedCycle && (
              <div className="text-right">
                <p className="text-xs text-muted">Ciclo Seleccionado</p>
                <p className="text-sm font-medium tabular-nums">
                  {formatDate(selectedCycle.cycle_start, "MMM d")} —{" "}
                  {formatDate(selectedCycle.cycle_end, "MMM d, yyyy")}
                </p>
                <p className="mt-1 text-xs text-warning tabular-nums">
                  Vence {formatDate(selectedCycle.due_date, "MMM d")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cycle navigation tabs */}
      {cycles.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <div className="flex gap-2 pb-2 min-w-max">
            {cycles.map((cycle) => {
              const active = cycle.id === selectedCycleId;
              return (
                <button
                  key={cycle.id}
                  onClick={() => setQuery("cycle", cycle.id)}
                  className={`flex flex-col rounded-lg border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-brand bg-brand/5"
                      : "border-surface-3 bg-surface-1 hover:border-surface-4"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusBadge(cycle.status)}`}>
                      {cycle.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-medium tabular-nums whitespace-nowrap">
                    {formatDate(cycle.cycle_start, "MMM d")} —{" "}
                    {formatDate(cycle.cycle_end, "MMM d")}
                  </p>
                  <p className="text-xs text-muted tabular-nums mt-0.5">
                    {formatCurrency(Number(cycle.cycle_spending))} ·{" "}
                    {cycle.transaction_count} txns
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cycle detail */}
      {selectedCycle ? (
        <div className="mt-6 rounded-xl border border-surface-3 bg-surface-1 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">Transacciones del Ciclo</h3>
              <p className="text-xs text-muted">
                {formatDate(selectedCycle.cycle_start, "MMM d, yyyy")} —{" "}
                {formatDate(selectedCycle.cycle_end, "MMM d, yyyy")}
                {" · "}Vence {formatDate(selectedCycle.due_date, "MMM d, yyyy")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-muted">Total del Ciclo</p>
                <p className="text-lg font-semibold tabular-nums text-danger">
                  {formatCurrency(Number(selectedCycle.cycle_spending))}
                </p>
              </div>
              {selectedCycle.status === "open" &&
                new Date(selectedCycle.cycle_end) < new Date() && (
                  <button
                    onClick={handleCloseCycle}
                    disabled={closing}
                    className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/20"
                  >
                    {closing ? "Cerrando…" : "Cerrar Ciclo"}
                  </button>
                )}
            </div>
          </div>

          {selectedCycle.statement_balance !== null &&
            selectedCycle.status !== "open" && (
              <div className="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-surface-2 p-4">
                <div>
                  <p className="text-xs text-muted">Saldo del Estado de Cuenta</p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatCurrency(Number(selectedCycle.statement_balance))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Pagado</p>
                  <p className="text-sm font-medium tabular-nums text-brand">
                    {formatCurrency(Number(selectedCycle.paid_amount))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Pendiente</p>
                  <p className="text-sm font-medium tabular-nums text-danger">
                    {formatCurrency(
                      Math.max(
                        0,
                        Number(selectedCycle.statement_balance) -
                          Number(selectedCycle.paid_amount)
                      )
                    )}
                  </p>
                </div>
              </div>
            )}

          {/* Transactions */}
          {transactions.length === 0 ? (
            <div className="mt-6 flex h-32 items-center justify-center text-sm text-muted">
              Sin transacciones en este ciclo
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
                    <th className="pb-3 pr-4">Fecha</th>
                    <th className="pb-3 pr-4">Descripción</th>
                    <th className="pb-3 pr-4">Categoría</th>
                    <th className="pb-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-3">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-surface-2 transition-colors"
                    >
                      <td className="py-3 pr-4 tabular-nums text-muted whitespace-nowrap">
                        {formatDate(tx.date, "MMM d")}
                      </td>
                      <td className="py-3 pr-4">
                        <div>{tx.description}</div>
                        {tx.merchant && (
                          <div className="text-xs text-muted">
                            {tx.merchant}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {tx.category && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs whitespace-nowrap">
                            <span>{tx.category.icon}</span>
                            {tx.category.name}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right tabular-nums font-medium text-danger whitespace-nowrap">
                        {formatCurrency(Number(tx.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
          {selectedCard.statement_day
            ? "Sin ciclos de facturación aún. Se crearán automáticamente al agregar transacciones."
            : "Configura el día de corte en Cuentas → Tarjetas de Crédito para registrar ciclos."}
        </div>
      )}
    </div>
  );
}
