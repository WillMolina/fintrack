import { createServerSupabase } from "@/lib/supabase-server";
import type { CategoryRule } from "@/lib/types";
import {
  fetchAllRuleTxs,
  findRuleCategory,
  sortRules,
  suggestRules,
} from "@/lib/category-rules";
import { RulesManager } from "./rules-manager";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const supabase = await createServerSupabase();

  const [{ data: categories }, { data: rulesRaw, error: rulesError }, txs] =
    await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("category_rules")
        .select("*, category:categories(*)")
        .order("created_at"),
      fetchAllRuleTxs(supabase),
    ]);

  const rules = (rulesRaw ?? []) as CategoryRule[];
  const activeRules = sortRules(rules);

  // Uncategorized transactions that the current rules would fill
  const preview = txs
    .filter((t) => !t.category_id)
    .map((t) => {
      const rule = findRuleCategory(activeRules, t.description, t.merchant);
      return rule ? { ...t, category_id: rule.category_id, rule_pattern: rule.pattern } : null;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reglas de categoría</h1>
      <p className="mt-1 text-sm text-muted">
        Autocompleta la categoría según la descripción o el comercio. Lo que ninguna regla
        reconozca queda sin categoría.
      </p>
      {rulesError ? (
        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          No se pudieron cargar las reglas ({rulesError.message}). ¿Ya corriste la migración{" "}
          <code>005_category_rules.sql</code> en Supabase?
        </div>
      ) : (
        <div className="mt-6">
          <RulesManager
            categories={categories ?? []}
            rules={rules}
            suggestions={suggestRules(txs, activeRules)}
            preview={preview}
            uncategorizedCount={txs.filter((t) => !t.category_id).length}
          />
        </div>
      )}
    </div>
  );
}
