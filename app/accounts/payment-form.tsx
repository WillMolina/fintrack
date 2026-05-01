"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Account } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function PaymentForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const creditCards = accounts.filter((a) => a.type === "credit_card");
  const fundingAccounts = accounts.filter((a) => a.type !== "credit_card");

  const [form, setForm] = useState({
    credit_card_id: "",
    from_account_id: "",
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const selectedCC = creditCards.find((c) => c.id === form.credit_card_id);
  const selectedFrom = fundingAccounts.find((a) => a.id === form.from_account_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("cc_payments").insert({
      credit_card_id: form.credit_card_id,
      from_account_id: form.from_account_id,
      amount,
      payment_date: form.payment_date,
      notes: form.notes || null,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(`Paid ${formatCurrency(amount)} to ${selectedCC?.name}`);
      setForm({
        credit_card_id: "",
        from_account_id: "",
        amount: "",
        payment_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      router.refresh();
    }
    setLoading(false);
  };

  if (creditCards.length === 0) {
    return (
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
        Add a credit card account first.
      </div>
    );
  }

  if (fundingAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
        Add a checking or cash account to make payments from.
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-6">
        <h2 className="font-medium">Make a Credit Card Payment</h2>
        <p className="mt-1 text-xs text-muted">
          This decreases the credit card balance and the source account's
          available money.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted">
              Credit Card
            </label>
            <select
              required
              value={form.credit_card_id}
              onChange={(e) =>
                setForm({ ...form, credit_card_id: e.target.value })
              }
              className={inputClass}
            >
              <option value="">Select a credit card…</option>
              {creditCards.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name} — {formatCurrency(cc.balance)} owed
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted">
              Pay From
            </label>
            <select
              required
              value={form.from_account_id}
              onChange={(e) =>
                setForm({ ...form, from_account_id: e.target.value })
              }
              className={inputClass}
            >
              <option value="">Select source account…</option>
              {fundingAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {formatCurrency(acc.balance)} available
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-muted">
                Amount
              </label>
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
              {selectedCC && (
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, amount: selectedCC.balance.toString() })
                  }
                  className="mt-1 text-xs text-brand hover:underline"
                >
                  Pay full balance ({formatCurrency(selectedCC.balance)})
                </button>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted">Date</label>
              <input
                type="date"
                required
                value={form.payment_date}
                onChange={(e) =>
                  setForm({ ...form, payment_date: e.target.value })
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
          {selectedCC && selectedFrom && form.amount && (
            <div className="rounded-lg border border-surface-3 bg-surface-2 p-4 text-xs">
              <p className="text-muted">After this payment:</p>
              <div className="mt-2 space-y-1 tabular-nums">
                <div className="flex justify-between">
                  <span>{selectedCC.name}</span>
                  <span className="text-danger">
                    {formatCurrency(selectedCC.balance)} →{" "}
                    {formatCurrency(
                      Math.max(0, selectedCC.balance - parseFloat(form.amount || "0"))
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{selectedFrom.name}</span>
                  <span>
                    {formatCurrency(selectedFrom.balance)} →{" "}
                    {formatCurrency(
                      selectedFrom.balance - parseFloat(form.amount || "0")
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
            {loading ? "Processing…" : "Make Payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
