"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Account } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function TransferForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const transferable = accounts.filter((a) => a.type !== "credit_card");

  const [form, setForm] = useState({
    from_account_id: "",
    to_account_id: "",
    amount: "",
    transfer_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const fromAcc = transferable.find((a) => a.id === form.from_account_id);
  const toAcc = transferable.find((a) => a.id === form.to_account_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.from_account_id === form.to_account_id) {
      setError("From and To must be different accounts");
      return;
    }

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("transfers").insert({
      from_account_id: form.from_account_id,
      to_account_id: form.to_account_id,
      amount,
      transfer_date: form.transfer_date,
      notes: form.notes || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(
        `Transferred ${formatCurrency(amount)} from ${fromAcc?.name} to ${toAcc?.name}`
      );
      setForm({
        from_account_id: "",
        to_account_id: "",
        amount: "",
        transfer_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      router.refresh();
    }
    setLoading(false);
  };

  if (transferable.length < 2) {
    return (
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
        You need at least two non-credit accounts to make transfers.
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-6">
        <h2 className="font-medium">Transfer Between Accounts</h2>
        <p className="mt-1 text-xs text-muted">
          Move money between your checking, cash, savings accounts. Doesn't
          affect your expenses.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-muted">From</label>
              <select
                required
                value={form.from_account_id}
                onChange={(e) =>
                  setForm({ ...form, from_account_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Select source…</option>
                {transferable.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-muted">To</label>
              <select
                required
                value={form.to_account_id}
                onChange={(e) =>
                  setForm({ ...form, to_account_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Select destination…</option>
                {transferable
                  .filter((acc) => acc.id !== form.from_account_id)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatCurrency(acc.balance)})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-muted">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">Date</label>
              <input
                type="date"
                required
                value={form.transfer_date}
                onChange={(e) =>
                  setForm({ ...form, transfer_date: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted">Notes</label>
            <input
              type="text"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputClass}
            />
          </div>

          {/* Preview */}
          {fromAcc && toAcc && form.amount && (
            <div className="rounded-lg border border-surface-3 bg-surface-2 p-4 text-xs">
              <p className="text-muted">After this transfer:</p>
              <div className="mt-2 space-y-1 tabular-nums">
                <div className="flex justify-between">
                  <span>{fromAcc.name}</span>
                  <span>
                    {formatCurrency(fromAcc.balance)} →{" "}
                    {formatCurrency(
                      fromAcc.balance - parseFloat(form.amount || "0")
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{toAcc.name}</span>
                  <span className="text-brand">
                    {formatCurrency(toAcc.balance)} →{" "}
                    {formatCurrency(
                      toAcc.balance + parseFloat(form.amount || "0")
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-lg bg-brand/10 px-3 py-2 text-xs text-brand">
              ✓ {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
          >
            {loading ? "Processing…" : "Transfer"}
          </button>
        </form>
      </div>
    </div>
  );
}
