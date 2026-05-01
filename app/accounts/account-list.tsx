"use client";

import type { Account } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const TYPE_LABELS: Record<Account["type"], string> = {
  credit_card: "Tarjeta de Crédito",
  debit:       "Débito",
  checking:    "Cuenta Corriente",
  savings:     "Ahorros",
  cash:        "Efectivo",
  other:       "Otro",
};

const TYPE_ICONS: Record<Account["type"], string> = {
  credit_card: "💳",
  debit:       "🏧",
  checking:    "🏦",
  savings:     "💰",
  cash:        "💵",
  other:       "📦",
};

export function AccountList({ accounts }: { accounts: Account[] }) {
  // Net worth: sum of non-CC balances minus CC debt
  const netWorth = accounts.reduce((sum, a) => {
    return a.type === "credit_card" ? sum - a.balance : sum + a.balance;
  }, 0);

  const totalAssets = accounts
    .filter((a) => a.type !== "credit_card")
    .reduce((s, a) => s + a.balance, 0);

  const totalDebt = accounts
    .filter((a) => a.type === "credit_card")
    .reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      {/* Net worth summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Total Activos
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-brand">
            {formatCurrency(totalAssets)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Deuda Total
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-danger">
            {formatCurrency(totalDebt)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Patrimonio Neto
          </p>
          <p
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              netWorth >= 0 ? "text-brand" : "text-danger"
            }`}
          >
            {formatCurrency(netWorth)}
          </p>
        </div>
      </div>

      {/* Account cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((acc) => {
          const isCC = acc.type === "credit_card";
          return (
            <div
              key={acc.id}
              className="rounded-xl border border-surface-3 bg-surface-1 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{TYPE_ICONS[acc.type]}</span>
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted">{TYPE_LABELS[acc.type]}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-muted">
                  {isCC ? "Adeudado" : "Disponible"}
                </p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    isCC
                      ? acc.balance > 0
                        ? "text-danger"
                        : "text-brand"
                      : "text-white"
                  }`}
                >
                  {formatCurrency(acc.balance)}
                </p>
                {isCC && acc.credit_limit && (
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    of {formatCurrency(acc.credit_limit)} limit
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
