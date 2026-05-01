"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Account, CreditCardStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function CreditCards({
  accounts,
  ccStatus,
}: {
  accounts: Account[];
  ccStatus: CreditCardStatus[];
}) {
  const ccAccounts = accounts.filter((a) => a.type === "credit_card");

  if (ccAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
        No credit cards yet. Add a credit card account first.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {ccAccounts.map((cc) => {
        const status = ccStatus.find((s) => s.id === cc.id);
        return <CreditCardCard key={cc.id} account={cc} status={status} />;
      })}
    </div>
  );
}

function CreditCardCard({
  account,
  status,
}: {
  account: Account;
  status?: CreditCardStatus;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    credit_limit: account.credit_limit?.toString() ?? "",
    statement_day: account.statement_day?.toString() ?? "",
    due_day: account.due_day?.toString() ?? "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase
      .from("accounts")
      .update({
        credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
        statement_day: form.statement_day ? parseInt(form.statement_day) : null,
        due_day: form.due_day ? parseInt(form.due_day) : null,
      })
      .eq("id", account.id);
    setEditing(false);
    router.refresh();
  };

  const utilization = status?.utilization_pct ?? 0;
  const utilizationColor =
    utilization >= 80 ? "bg-danger" : utilization >= 30 ? "bg-warning" : "bg-brand";

  return (
    <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💳</span>
            <h3 className="font-medium">{account.name}</h3>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className="rounded-lg border border-surface-4 px-3 py-1 text-xs text-muted hover:text-white"
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted">
              Credit Limit
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="5000.00"
              value={form.credit_limit}
              onChange={(e) =>
                setForm({ ...form, credit_limit: e.target.value })
              }
              className="w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">
                Statement Day
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="15"
                value={form.statement_day}
                onChange={(e) =>
                  setForm({ ...form, statement_day: e.target.value })
                }
                className="w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Due Day</label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="5"
                value={form.due_day}
                onChange={(e) => setForm({ ...form, due_day: e.target.value })}
                className="w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim"
          >
            Save
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Balance */}
          <div>
            <p className="text-xs text-muted">Amount Owed</p>
            <p className="text-3xl font-semibold tabular-nums text-danger">
              {formatCurrency(account.balance)}
            </p>
            {account.credit_limit && (
              <p className="text-xs text-muted tabular-nums">
                of {formatCurrency(account.credit_limit)} limit
              </p>
            )}
          </div>

          {/* Utilization bar */}
          {account.credit_limit && (
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-muted">Utilization</span>
                <span className="tabular-nums">{utilization.toFixed(1)}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full rounded-full bg-surface-3">
                <div
                  className={`h-full rounded-full transition-all ${utilizationColor}`}
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted">
                Available:{" "}
                <span className="tabular-nums text-white">
                  {formatCurrency(status?.available_credit ?? 0)}
                </span>
              </p>
            </div>
          )}

          {/* Cycle info */}
          {status && (
            <div className="grid grid-cols-3 gap-3 border-t border-surface-3 pt-4">
              <div>
                <p className="text-xs text-muted">Cycle</p>
                <p className="text-xs tabular-nums">
                  {formatDate(status.cycle_start, "MMM d")} —{" "}
                  {formatDate(status.cycle_end, "MMM d")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Cycle Spending</p>
                <p className="text-xs tabular-nums font-medium">
                  {formatCurrency(status.cycle_spending)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Due</p>
                <p className="text-xs tabular-nums font-medium text-warning">
                  {formatDate(status.due_date, "MMM d")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
