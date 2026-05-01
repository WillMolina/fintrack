"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Category, Account } from "@/lib/types";

export function AddTransactionForm({
  categories,
  accounts,
}: {
  categories: Category[];
  accounts: Account[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    description: "",
    merchant: "",
    date: new Date().toISOString().split("T")[0],
    category_id: "",
    account_id: "",
    notes: "",
    is_income: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("transactions").insert({
      amount: form.is_income ? -amount : amount, // negative = income
      description: form.description,
      merchant: form.merchant || null,
      date: form.date,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      notes: form.notes || null,
      source: "manual",
    });

    if (!error) {
      setForm({
        amount: "",
        description: "",
        merchant: "",
        date: new Date().toISOString().split("T")[0],
        category_id: "",
        account_id: "",
        notes: "",
        is_income: false,
      });
      router.refresh();
    }

    setLoading(false);
  };

  const inputClass =
    "w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Amount + type toggle */}
        <div>
          <label className="mb-1.5 block text-xs text-muted">Amount</label>
          <div className="flex gap-2">
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
            <button
              type="button"
              onClick={() => setForm({ ...form, is_income: !form.is_income })}
              className={`shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${
                form.is_income
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-danger bg-danger/10 text-danger"
              }`}
            >
              {form.is_income ? "Income" : "Expense"}
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs text-muted">
            Description
          </label>
          <input
            type="text"
            required
            placeholder="Grocery run, Netflix, etc."
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className={inputClass}
          />
        </div>

        {/* Merchant */}
        <div>
          <label className="mb-1.5 block text-xs text-muted">Merchant</label>
          <input
            type="text"
            placeholder="Optional"
            value={form.merchant}
            onChange={(e) => setForm({ ...form, merchant: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Date */}
        <div>
          <label className="mb-1.5 block text-xs text-muted">Date</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputClass}
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1.5 block text-xs text-muted">Category</label>
          <select
            value={form.category_id}
            onChange={(e) =>
              setForm({ ...form, category_id: e.target.value })
            }
            className={inputClass}
          >
            <option value="">Uncategorized</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Account */}
        <div>
          <label className="mb-1.5 block text-xs text-muted">Account</label>
          <select
            value={form.account_id}
            onChange={(e) =>
              setForm({ ...form, account_id: e.target.value })
            }
            className={inputClass}
          >
            <option value="">No account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
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

        {/* Submit */}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dim disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Transaction"}
          </button>
        </div>
      </div>
    </form>
  );
}
