"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Modal } from "@/components/ui/modal";
import type { Category, Account, BillingCycle, Transaction } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function AddTransactionModal({
  open,
  onClose,
  categories,
  accounts,
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: Account[];
  transaction?: Transaction;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const blankForm = {
    amount: "",
    description: "",
    merchant: "",
    date: new Date().toISOString().split("T")[0],
    category_id: "",
    account_id: "",
    billing_cycle_id: "",
    notes: "",
    is_income: false,
  };

  const [form, setForm] = useState(blankForm);

  // Pre-fill form when editing an existing transaction
  useEffect(() => {
    if (open && transaction) {
      const amt = Number(transaction.amount);
      setForm({
        amount: String(Math.abs(amt)),
        description: transaction.description,
        merchant: transaction.merchant ?? "",
        date: transaction.date,
        category_id: transaction.category_id ?? "",
        account_id: transaction.account_id ?? "",
        billing_cycle_id: transaction.billing_cycle_id ?? "",
        notes: transaction.notes ?? "",
        is_income: amt < 0,
      });
    } else if (open && !transaction) {
      setForm(blankForm);
    }
    setError("");
  }, [open, transaction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetched cycles for the currently-selected CC account
  const [cycles, setCycles] = useState<BillingCycle[]>([]);

  const selectedAccount = accounts.find((a) => a.id === form.account_id);
  const isCC = selectedAccount?.type === "credit_card";

  // Load cycles whenever a CC account is selected
  useEffect(() => {
    if (!isCC || !form.account_id) {
      setCycles([]);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("billing_cycles")
        .select("*")
        .eq("account_id", form.account_id)
        .order("cycle_end", { ascending: false })
        .limit(12);
      setCycles((data ?? []) as BillingCycle[]);
    })();
  }, [form.account_id, isCC, supabase]);

  // Auto-select the cycle whose date range contains form.date
  useEffect(() => {
    if (!isCC || cycles.length === 0) return;
    const match = cycles.find(
      (c) => form.date >= c.cycle_start && form.date <= c.cycle_end
    );
    if (match && form.billing_cycle_id !== match.id) {
      setForm((f) => ({ ...f, billing_cycle_id: match.id }));
    }
  }, [form.date, cycles, isCC]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setLoading(true);

    // Build payload. Note: the DB trigger will auto-assign billing_cycle_id
    // but if the user explicitly picked one, we let it pass through.
    const payload: Record<string, unknown> = {
      amount: form.is_income ? -amount : amount,
      description: form.description,
      merchant: form.merchant || null,
      date: form.date,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      notes: form.notes || null,
    };
    if (isCC && form.billing_cycle_id) {
      payload.billing_cycle_id = form.billing_cycle_id;
    }

    const { error } = transaction
      ? await supabase.from("transactions").update(payload).eq("id", transaction.id)
      : await supabase.from("transactions").insert({ ...payload, source: "manual" });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setForm(blankForm);
    setLoading(false);
    onClose();
    router.refresh();
  };

  const inputClass =
    "w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <Modal open={open} onClose={onClose} title={transaction ? "Edit Transaction" : "Add Transaction"} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount + type toggle */}
        <div className="grid grid-cols-2 gap-4">
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
                autoFocus
              />
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, is_income: !form.is_income })
                }
                className={`shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${
                  form.is_income
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-danger bg-danger/10 text-danger"
                }`}
              >
                {form.is_income ? "+" : "−"}
              </button>
            </div>
          </div>
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
        </div>

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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-muted">Account</label>
          <select
            value={form.account_id}
            onChange={(e) =>
              setForm({
                ...form,
                account_id: e.target.value,
                billing_cycle_id: "",
              })
            }
            className={inputClass}
          >
            <option value="">No account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.type === "credit_card" ? "💳" : "🏦"} {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Billing cycle selector — only when CC */}
        {isCC && (
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-brand">
              💳 Billing Cycle
            </label>
            {cycles.length === 0 ? (
              <p className="text-xs text-muted">
                No cycles found. Set the statement day for this card in
                Accounts → Credit Cards.
              </p>
            ) : (
              <select
                value={form.billing_cycle_id}
                onChange={(e) =>
                  setForm({ ...form, billing_cycle_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">Auto-assign by date</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatDate(c.cycle_start, "MMM d")} —{" "}
                    {formatDate(c.cycle_end, "MMM d, yyyy")} · Due{" "}
                    {formatDate(c.due_date, "MMM d")} ·{" "}
                    {c.status === "open"
                      ? "🟢 Open"
                      : c.status === "closed"
                        ? "🔴 Closed"
                        : "✅ Paid"}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-2 text-xs text-muted">
              Defaults to the cycle containing the transaction date.
            </p>
          </div>
        )}

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

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-surface-4 px-4 py-2.5 text-sm font-medium text-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
          >
            {loading ? "Saving…" : transaction ? "Save Changes" : "Add Transaction"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
