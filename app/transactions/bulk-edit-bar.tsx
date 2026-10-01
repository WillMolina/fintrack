"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Transaction, Category, Account, BillingCycle } from "@/lib/types";
import { formatDate } from "@/lib/utils";

// "" = leave unchanged; NONE = set to null
const NONE = "__none__";

export function BulkEditBar({
  selected,
  categories,
  accounts,
  onClear,
}: {
  selected: Transaction[];
  categories: Category[];
  accounts: Account[];
  onClear: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [cycles, setCycles] = useState<BillingCycle[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The account the selection will end up on: the new one if chosen,
  // otherwise the shared current account (if every row has the same one).
  const sharedAccountId =
    selected.length > 0 &&
    selected.every((t) => t.account_id === selected[0].account_id)
      ? selected[0].account_id
      : null;
  const targetAccountId =
    accountId === NONE ? null : accountId || sharedAccountId;
  const targetAccount = accounts.find((a) => a.id === targetAccountId);
  const canPickCycle = targetAccount?.type === "credit_card";

  useEffect(() => {
    setCycleId("");
    if (!canPickCycle || !targetAccountId) {
      setCycles([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("billing_cycles")
        .select("*")
        .eq("account_id", targetAccountId)
        .order("cycle_end", { ascending: false })
        .limit(12);
      setCycles((data ?? []) as BillingCycle[]);
    })();
  }, [targetAccountId, canPickCycle]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasChanges = categoryId || accountId || (canPickCycle && cycleId);

  const handleApply = async () => {
    if (!hasChanges) return;
    setError("");
    setSaving(true);
    const ids = selected.map((t) => t.id);

    const payload: Record<string, unknown> = {};
    if (categoryId) payload.category_id = categoryId === NONE ? null : categoryId;
    if (accountId) payload.account_id = accountId === NONE ? null : accountId;

    if (Object.keys(payload).length > 0) {
      const { error } = await supabase
        .from("transactions")
        .update(payload)
        .in("id", ids);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    // Separate update: the DB trigger reassigns billing_cycle_id whenever
    // account_id is written, so the explicit cycle must be set afterwards.
    if (canPickCycle && cycleId) {
      const { error } = await supabase
        .from("transactions")
        .update({ billing_cycle_id: cycleId })
        .in("id", ids);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setCategoryId("");
    setAccountId("");
    setCycleId("");
    onClear();
    router.refresh();
  };

  const inputClass =
    "rounded-lg border border-surface-4 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none disabled:opacity-50";

  return (
    <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-medium text-brand">
          {selected.length} seleccionada{selected.length === 1 ? "" : "s"}
        </span>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass}
        >
          <option value="">Categoría: sin cambios</option>
          <option value={NONE}>Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={inputClass}
        >
          <option value="">Cuenta: sin cambios</option>
          <option value={NONE}>Sin cuenta</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.type === "credit_card" ? "💳" : "🏦"} {a.name}
            </option>
          ))}
        </select>

        <select
          value={cycleId}
          onChange={(e) => setCycleId(e.target.value)}
          disabled={!canPickCycle || cycles.length === 0}
          className={inputClass}
          title={
            canPickCycle
              ? undefined
              : "Disponible cuando todas las transacciones quedan en la misma tarjeta de crédito"
          }
        >
          <option value="">
            {canPickCycle
              ? cycles.length === 0
                ? "Sin ciclos para esta tarjeta"
                : "Ciclo: automático por fecha"
              : "Ciclo: requiere una sola TC"}
          </option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {formatDate(c.cycle_start, "MMM d")} —{" "}
              {formatDate(c.cycle_end, "MMM d, yyyy")} ·{" "}
              {c.status === "open"
                ? "🟢 Abierto"
                : c.status === "closed"
                  ? "🔴 Cerrado"
                  : "✅ Pagado"}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onClear}
            disabled={saving}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={saving || !hasChanges}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Aplicar"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
