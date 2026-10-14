"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Category, CategoryRule } from "@/lib/types";
import type { RuleSuggestion, RuleTx } from "@/lib/category-rules";
import { isValidRulePattern } from "@/lib/category-rules";
import { describePattern } from "@/lib/text-match";
import { formatCurrency, formatDate } from "@/lib/utils";

type PreviewTx = RuleTx & { category_id: string; rule_pattern: string };

const PREVIEW_ROWS = 100;
const UPDATE_CHUNK = 200; // keep .in() filters short enough for the URL

export function RulesManager({
  categories,
  rules,
  suggestions,
  preview,
  uncategorizedCount,
}: {
  categories: Category[];
  rules: CategoryRule[];
  suggestions: RuleSuggestion[];
  preview: PreviewTx[];
  uncategorizedCount: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const catLabel = (id: string) => {
    const c = categoryById.get(id);
    return c ? `${c.icon ?? ""} ${c.name}`.trim() : "—";
  };

  // ---------- Rule form ----------
  const [form, setForm] = useState({ pattern: "", category_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidRulePattern(form.pattern))
      return setError("La regla necesita al menos un término que no empiece con -");
    if (!form.category_id) return setError("Elige una categoría");

    setSaving(true);
    const payload = { pattern: form.pattern.trim(), category_id: form.category_id };
    const { error } = editingId
      ? await supabase.from("category_rules").update(payload).eq("id", editingId)
      : await supabase.from("category_rules").insert(payload);
    setSaving(false);
    if (error) return setError(error.message);
    setForm({ pattern: "", category_id: "" });
    setEditingId(null);
    router.refresh();
  };

  const startEdit = (r: CategoryRule) => {
    setEditingId(r.id);
    setError("");
    setForm({ pattern: r.pattern, category_id: r.category_id });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ pattern: "", category_id: "" });
    setError("");
  };

  const toggleActive = async (r: CategoryRule) => {
    await supabase.from("category_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    await supabase.from("category_rules").delete().eq("id", id);
    if (editingId === id) cancelEdit();
    router.refresh();
  };

  // ---------- Suggestions ----------
  const [drafts, setDrafts] = useState(() =>
    suggestions.map((s) => ({ ...s, selected: false }))
  );
  const [creating, setCreating] = useState(false);

  // Server recomputes suggestions after each change
  useEffect(() => {
    setDrafts(suggestions.map((s) => ({ ...s, selected: false })));
  }, [suggestions]);
  const selectedDrafts = drafts.filter((d) => d.selected);

  const updateDraft = (i: number, patch: Partial<(typeof drafts)[number]>) =>
    setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const toggleAllDrafts = () => {
    const all = selectedDrafts.length === drafts.length;
    setDrafts((prev) => prev.map((d) => ({ ...d, selected: !all })));
  };

  const createSelected = async () => {
    const valid = selectedDrafts.filter((d) => isValidRulePattern(d.pattern));
    if (valid.length === 0) return;
    setCreating(true);
    const { error } = await supabase.from("category_rules").insert(
      valid.map((d) => ({ pattern: d.pattern.trim(), category_id: d.category_id }))
    );
    setCreating(false);
    if (error) return alert(error.message);
    router.refresh();
  };

  // ---------- Apply to uncategorized ----------
  const [applying, setApplying] = useState(false);

  const applyRules = async () => {
    if (!confirm(`¿Asignar categoría a ${preview.length} transacciones?`)) return;
    setApplying(true);
    const byCategory = new Map<string, string[]>();
    for (const t of preview) {
      const ids = byCategory.get(t.category_id) ?? [];
      ids.push(t.id);
      byCategory.set(t.category_id, ids);
    }
    for (const [categoryId, ids] of byCategory) {
      for (let i = 0; i < ids.length; i += UPDATE_CHUNK) {
        const { error } = await supabase
          .from("transactions")
          .update({ category_id: categoryId })
          .in("id", ids.slice(i, i + UPDATE_CHUNK))
          .is("category_id", null);
        if (error) {
          setApplying(false);
          return alert(error.message);
        }
      }
    }
    setApplying(false);
    router.refresh();
  };

  const inputClass =
    "w-full rounded-lg border border-surface-4 bg-surface-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
  const smallInput =
    "rounded-lg border border-surface-4 bg-surface-2 px-2 py-1 text-sm text-white focus:border-brand focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Rules */}
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <h2 className="font-medium">Reglas</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            placeholder="Ej: uber, -eats"
            value={form.pattern}
            onChange={(e) => setForm({ ...form, pattern: e.target.value })}
            className={inputClass}
          />
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
            >
              {saving ? "Guardando…" : editingId ? "Guardar" : "Agregar"}
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
        <p className="mt-2 text-xs text-muted">
          Busca en la descripción y el comercio, sin importar mayúsculas ni tildes. Separa
          términos con comas y antepón <b>-</b> para excluir. Si varias reglas coinciden, gana
          la del término más largo.
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}

        {rules.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted">
            Aún no tienes reglas. Empieza con las sugerencias de abajo.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-surface-3">
            {rules.map((r) => (
              <div
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-2 py-2.5 ${r.is_active ? "" : "opacity-50"}`}
              >
                <div className="text-sm">
                  <span className="text-muted">{describePattern(r.pattern)}</span>
                  <span className="mx-2 text-muted">→</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs">
                    {catLabel(r.category_id)}
                  </span>
                  {!r.is_active && <span className="ml-2 text-xs text-muted">pausada</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleActive(r)}
                    className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-3 hover:text-white"
                  >
                    {r.is_active ? "Pausar" : "Activar"}
                  </button>
                  <button
                    onClick={() => startEdit(r)}
                    className="rounded p-1 text-muted transition-colors hover:bg-surface-3 hover:text-white"
                    title="Editar"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply to uncategorized */}
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Transacciones sin categoría</h2>
            <p className="mt-1 text-sm text-muted">
              {uncategorizedCount} sin categoría · las reglas actuales reconocen{" "}
              {preview.length}
            </p>
          </div>
          {preview.length > 0 && (
            <button
              onClick={applyRules}
              disabled={applying}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
            >
              {applying ? "Aplicando…" : `Aplicar a ${preview.length}`}
            </button>
          )}
        </div>
        {preview.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Descripción</th>
                  <th className="py-2 pr-4 text-right">Monto</th>
                  <th className="py-2 pr-4">Nueva categoría</th>
                  <th className="py-2">Regla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-3">
                {preview.slice(0, PREVIEW_ROWS).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-4 tabular-nums text-muted whitespace-nowrap">
                      {formatDate(t.date, "MMM d, yyyy")}
                    </td>
                    <td className="py-2 pr-4">
                      <div>{t.description}</div>
                      {t.merchant && <div className="text-xs text-muted">{t.merchant}</div>}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(Math.abs(Number(t.amount)))}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{catLabel(t.category_id)}</td>
                    <td className="py-2 text-xs text-muted">{t.rule_pattern}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > PREVIEW_ROWS && (
              <p className="mt-2 text-xs text-muted">
                y {preview.length - PREVIEW_ROWS} más…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Sugerencias desde tu historial</h2>
            <p className="mt-1 text-sm text-muted">
              Palabras que aparecen en 2 o más transacciones y que casi siempre (80%+) tienen la
              misma categoría. Revisa, ajusta y crea las que quieras.
            </p>
          </div>
          {selectedDrafts.length > 0 && (
            <button
              onClick={createSelected}
              disabled={creating}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim disabled:opacity-50"
            >
              {creating ? "Creando…" : `Crear ${selectedDrafts.length} regla${selectedDrafts.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>

        {drafts.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted">
            No hay sugerencias nuevas. Categoriza más transacciones para que aparezcan.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="w-8 py-2">
                    <input
                      type="checkbox"
                      checked={selectedDrafts.length === drafts.length}
                      onChange={toggleAllDrafts}
                      className="h-4 w-4 cursor-pointer accent-brand"
                    />
                  </th>
                  <th className="py-2 pr-3">Si contiene</th>
                  <th className="py-2 pr-3">Categoría</th>
                  <th className="py-2 pr-3">Historial</th>
                  <th className="py-2">Ejemplos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-3">
                {drafts.map((d, i) => (
                  <tr key={i} className={d.selected ? "bg-brand/5" : ""}>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={d.selected}
                        onChange={() => updateDraft(i, { selected: !d.selected })}
                        className="h-4 w-4 cursor-pointer accent-brand"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={d.pattern}
                        onChange={(e) => updateDraft(i, { pattern: e.target.value })}
                        className={`${smallInput} w-36`}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={d.category_id}
                        onChange={(e) => updateDraft(i, { category_id: e.target.value })}
                        className={smallInput}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
                      {d.matches} tx · {d.share_pct}%
                      {d.conflicts > 0 && (
                        <span className="text-warning"> · {d.conflicts} en otra</span>
                      )}
                      {d.fills > 0 && (
                        <span className="text-brand"> · llena {d.fills}</span>
                      )}
                    </td>
                    <td className="py-2 text-xs text-muted">{d.examples.join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
