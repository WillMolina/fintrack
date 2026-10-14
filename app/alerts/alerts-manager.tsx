"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Category, SpendingAlert, SpendingAlertStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const blankForm = {
  category_id: "",
  description_pattern: "",
  monthly_limit: "",
  threshold_pct: "80",
};

const LEVEL_STYLES = {
  ok: { bar: "bg-brand", text: "text-brand", label: "En rango" },
  warning: { bar: "bg-warning", text: "text-warning", label: "Cerca del tope" },
  exceeded: { bar: "bg-danger", text: "text-danger", label: "Tope superado" },
} as const;

export function AlertsManager({
  categories,
  statuses,
}: {
  categories: Category[];
  statuses: SpendingAlertStatus[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const limit = parseFloat(form.monthly_limit.replace(/,/g, ""));
    const threshold = parseInt(form.threshold_pct, 10);
    if (!form.category_id) return setError("Elige una categoría");
    if (isNaN(limit) || limit <= 0) return setError("Ingresa un tope válido");
    if (isNaN(threshold) || threshold < 1 || threshold > 100)
      return setError("El porcentaje de aviso debe estar entre 1 y 100");

    setLoading(true);
    const payload = {
      category_id: form.category_id,
      description_pattern: form.description_pattern.trim() || null,
      monthly_limit: limit,
      threshold_pct: threshold,
      // Re-arm notifications whenever the rule changes
      last_alert_month: null,
      last_alert_level: null,
    };
    const { error } = editingId
      ? await supabase.from("spending_alerts").update(payload).eq("id", editingId)
      : await supabase.from("spending_alerts").insert(payload);
    setLoading(false);

    if (error) return setError(error.message);
    setForm(blankForm);
    setEditingId(null);
    router.refresh();
  };

  const startEdit = (a: SpendingAlert) => {
    setEditingId(a.id);
    setError("");
    setForm({
      category_id: a.category_id,
      description_pattern: a.description_pattern ?? "",
      monthly_limit: String(a.monthly_limit),
      threshold_pct: String(a.threshold_pct),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(blankForm);
    setError("");
  };

  const toggleActive = async (a: SpendingAlert) => {
    await supabase
      .from("spending_alerts")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta alerta?")) return;
    await supabase.from("spending_alerts").delete().eq("id", id);
    if (editingId === id) cancelEdit();
    router.refresh();
  };

  const inputClass =
    "w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="space-y-6">
      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-surface-3 bg-surface-1 p-5"
      >
        <h2 className="font-medium">{editingId ? "Editar alerta" : "Nueva alerta"}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs text-muted">Categoría</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Elige una categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">
              Descripción (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Uber, Rappi"
              value={form.description_pattern}
              onChange={(e) =>
                setForm({ ...form, description_pattern: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">Tope mensual</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={form.monthly_limit}
              onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-muted">Avisar al (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={form.threshold_pct}
              onChange={(e) => setForm({ ...form, threshold_pct: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          La descripción se busca dentro de la descripción o el comercio de cada transacción
          (sin importar mayúsculas ni tildes). Déjala vacía para vigilar toda la categoría.
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
          >
            {loading ? "Guardando…" : editingId ? "Guardar cambios" : "Crear alerta"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-surface-4 px-4 py-2 text-sm text-muted hover:text-white"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* List with this month's progress */}
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <h2 className="font-medium">Este mes</h2>
        {statuses.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">
            Aún no tienes alertas configuradas
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {statuses.map(({ alert: a, spent, pct, remaining, level }) => {
              const style = LEVEL_STYLES[level];
              return (
                <div
                  key={a.id}
                  className={`rounded-lg bg-surface-2 p-4 ${a.is_active ? "" : "opacity-50"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {a.category?.icon} {a.category?.name}
                        {a.description_pattern && (
                          <span className="ml-2 rounded bg-surface-3 px-2 py-0.5 text-xs text-muted">
                            “{a.description_pattern}”
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        Tope {formatCurrency(Number(a.monthly_limit))} · aviso al{" "}
                        {a.threshold_pct}%{!a.is_active && " · pausada"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleActive(a)}
                        className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-3 hover:text-white"
                      >
                        {a.is_active ? "Pausar" : "Activar"}
                      </button>
                      <button
                        onClick={() => startEdit(a)}
                        className="rounded p-1 text-muted transition-colors hover:bg-surface-3 hover:text-white"
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        title="Eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 w-full rounded-full bg-surface-3">
                    <div
                      className={`h-1.5 rounded-full ${style.bar}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="tabular-nums text-muted">
                      {formatCurrency(spent)} gastado ·{" "}
                      {remaining >= 0
                        ? `quedan ${formatCurrency(remaining)}`
                        : `excedido por ${formatCurrency(-remaining)}`}
                    </span>
                    <span className={`font-medium ${style.text}`}>
                      {pct}% · {style.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
