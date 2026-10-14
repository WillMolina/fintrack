import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRule } from "@/lib/types";
import { normalize, parsePattern, textMatches } from "@/lib/text-match";

// ============================================================
// Category auto-fill rules. A rule needs at least one include term;
// when several match, the one with the longest term wins (most specific).
// Transactions that match no rule stay uncategorized.
// ============================================================

type RuleLike = Pick<CategoryRule, "pattern" | "category_id" | "is_active" | "created_at">;

export function isValidRulePattern(pattern: string) {
  return parsePattern(pattern).include.length > 0;
}

const specificity = (pattern: string) =>
  Math.max(0, ...parsePattern(pattern).include.map((t) => t.length));

export function sortRules<T extends RuleLike>(rules: T[]): T[] {
  return rules
    .filter((r) => r.is_active && isValidRulePattern(r.pattern))
    .sort(
      (a, b) =>
        specificity(b.pattern) - specificity(a.pattern) ||
        a.created_at.localeCompare(b.created_at)
    );
}

/** Rules must already be sorted with sortRules. */
export function findRuleCategory<T extends RuleLike>(
  sortedRules: T[],
  description: string,
  merchant: string | null
): T | null {
  return sortedRules.find((r) => textMatches(r.pattern, description, merchant)) ?? null;
}

export async function fetchActiveRules(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("category_rules")
    .select("*")
    .eq("is_active", true);
  return sortRules((data ?? []) as CategoryRule[]);
}

// ============================================================
// Suggestions learned from already-categorized transactions
// ============================================================

export type RuleTx = {
  id: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  category_id: string | null;
};

export interface RuleSuggestion {
  pattern: string;
  category_id: string;
  matches: number; // categorized transactions containing the term
  share_pct: number; // % of those already in category_id
  conflicts: number; // categorized in a different category (would not change)
  fills: number; // uncategorized transactions it would fill
  examples: string[];
}

// Bank-notification filler words that say nothing about the category
const STOPWORDS = new Set([
  "compra", "compras", "pago", "pagos", "con", "por", "para", "del", "las", "los", "una", "uno",
  "transaccion", "transferencia", "tarjeta", "credito", "debito", "cuenta", "ahorros",
  "corriente", "retiro", "cajero", "abono", "cargo", "valor", "cop", "usd", "col", "sas",
  "ltda", "www", "com", "http", "https", "the", "and", "pse", "aprobada", "realizada",
  "realizaste", "exitosa", "bogota", "medellin", "colombia", "nacional", "internacional",
]);

const MIN_MATCHES = 2;
const MIN_SHARE = 0.8;
const MAX_SUGGESTIONS = 50;

function terms(tx: RuleTx) {
  const words = normalize(`${tx.description} ${tx.merchant ?? ""}`)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !STOPWORDS.has(w));
  return new Set(words);
}

export function suggestRules(txs: RuleTx[], sortedRules: RuleLike[]): RuleSuggestion[] {
  // Index: term → transactions containing it
  const byTerm = new Map<string, RuleTx[]>();
  for (const tx of txs) {
    for (const t of terms(tx)) {
      const list = byTerm.get(t) ?? [];
      list.push(tx);
      byTerm.set(t, list);
    }
  }

  const candidates: (RuleSuggestion & { ids: Set<string> })[] = [];
  for (const [term, list] of byTerm) {
    // Already handled by an existing rule
    if (list.every((t) => findRuleCategory(sortedRules, t.description, t.merchant))) continue;

    const categorized = list.filter((t) => t.category_id);
    if (categorized.length < MIN_MATCHES) continue;

    const counts = new Map<string, number>();
    for (const t of categorized) counts.set(t.category_id!, (counts.get(t.category_id!) ?? 0) + 1);
    const [topCategory, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCount / categorized.length < MIN_SHARE) continue;

    candidates.push({
      pattern: term,
      category_id: topCategory,
      matches: categorized.length,
      share_pct: Math.round((topCount / categorized.length) * 100),
      conflicts: categorized.length - topCount,
      fills: list.length - categorized.length,
      examples: [...new Set(list.map((t) => t.merchant || t.description))].slice(0, 3),
      ids: new Set(list.map((t) => t.id)),
    });
  }

  // Drop redundant terms: if a broader term in the same category already
  // covers the same transactions (e.g. "uber" vs "trip"), keep the broader one.
  // On identical coverage, keep the longer (more readable) term.
  candidates.sort(
    (a, b) => b.ids.size - a.ids.size || b.pattern.length - a.pattern.length
  );
  const kept: typeof candidates = [];
  for (const c of candidates) {
    const redundant = kept.some(
      (k) => k.category_id === c.category_id && [...c.ids].every((id) => k.ids.has(id))
    );
    if (!redundant) kept.push(c);
  }

  return kept
    .sort((a, b) => b.fills - a.fills || b.matches - a.matches)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ ids: _ids, ...s }) => s);
}

const PAGE_SIZE = 1000; // Supabase max rows per request

export async function fetchAllRuleTxs(supabase: SupabaseClient): Promise<RuleTx[]> {
  const rows: RuleTx[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id, date, description, merchant, amount, category_id")
      .order("date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as RuleTx[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
