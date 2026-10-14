import type { SupabaseClient } from "@supabase/supabase-js";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import type { SpendingAlert, SpendingAlertStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { describePattern, textMatches } from "@/lib/text-match";

type MatchableTx = {
  category_id: string | null;
  description: string;
  merchant: string | null;
  amount: number;
};

export function alertMatches(alert: SpendingAlert, tx: MatchableTx) {
  if (tx.category_id !== alert.category_id || Number(tx.amount) <= 0) return false;
  return textMatches(alert.description_pattern, tx.description, tx.merchant);
}

/**
 * Spending vs. cap for every alert in the given month (YYYY-MM).
 * Spending counts every expense, including credit card charges.
 */
export async function getAlertStatuses(
  supabase: SupabaseClient,
  monthStr: string,
  { activeOnly = false } = {}
): Promise<SpendingAlertStatus[]> {
  let query = supabase
    .from("spending_alerts")
    .select("*, category:categories(*)")
    .order("created_at");
  if (activeOnly) query = query.eq("is_active", true);
  const { data: alertsRaw } = await query;
  const alerts = (alertsRaw ?? []) as SpendingAlert[];
  if (alerts.length === 0) return [];

  const monthDate = parseISO(`${monthStr}-01`);
  const { data: txRaw } = await supabase
    .from("transactions")
    .select("category_id, description, merchant, amount")
    .in("category_id", [...new Set(alerts.map((a) => a.category_id))])
    .gt("amount", 0)
    .gte("date", format(startOfMonth(monthDate), "yyyy-MM-dd"))
    .lte("date", format(endOfMonth(monthDate), "yyyy-MM-dd"));
  const txs = (txRaw ?? []) as MatchableTx[];

  return alerts.map((alert) => {
    const spent = txs
      .filter((t) => alertMatches(alert, t))
      .reduce((s, t) => s + Number(t.amount), 0);
    const limit = Number(alert.monthly_limit);
    const pct = Math.round((spent / limit) * 1000) / 10;
    return {
      alert,
      spent,
      pct,
      remaining: limit - spent,
      level:
        pct >= 100 ? "exceeded" : pct >= alert.threshold_pct ? "warning" : "ok",
    };
  });
}

export function alertLabel(alert: SpendingAlert) {
  const cat = alert.category ? `${alert.category.icon ?? ""} ${alert.category.name}`.trim() : "Categoría";
  const desc = describePattern(alert.description_pattern);
  return desc ? `${cat} · ${desc}` : cat;
}

export function alertMessage(s: SpendingAlertStatus) {
  const limit = Number(s.alert.monthly_limit);
  return s.level === "exceeded"
    ? `🚨 Superaste el tope de ${alertLabel(s.alert)}: ${formatCurrency(s.spent)} de ${formatCurrency(limit)} (${s.pct}%).`
    : `⚠️ Vas en ${s.pct}% del tope de ${alertLabel(s.alert)}: ${formatCurrency(s.spent)} de ${formatCurrency(limit)}. Te quedan ${formatCurrency(s.remaining)}.`;
}

const LEVEL_RANK = { ok: 0, warning: 1, exceeded: 2 } as const;

/**
 * Alerts that just crossed a new level this month because of `tx`.
 * Marks them as notified so the same level isn't sent twice in a month.
 */
export async function collectNewAlerts(
  supabase: SupabaseClient,
  tx: MatchableTx & { date: string }
) {
  if (!tx.category_id || Number(tx.amount) <= 0) return [];

  const monthStr = tx.date.slice(0, 7);
  const monthKey = `${monthStr}-01`;
  const statuses = await getAlertStatuses(supabase, monthStr, { activeOnly: true });

  const fresh = statuses.filter((s) => {
    if (s.level === "ok" || !alertMatches(s.alert, tx)) return false;
    const notifiedRank =
      s.alert.last_alert_month === monthKey && s.alert.last_alert_level
        ? LEVEL_RANK[s.alert.last_alert_level]
        : 0;
    return LEVEL_RANK[s.level] > notifiedRank;
  });

  await Promise.all(
    fresh.map((s) =>
      supabase
        .from("spending_alerts")
        .update({ last_alert_month: monthKey, last_alert_level: s.level })
        .eq("id", s.alert.id)
    )
  );

  return fresh.map((s) => ({
    id: s.alert.id,
    level: s.level,
    category: s.alert.category?.name ?? null,
    description: s.alert.description_pattern,
    spent: s.spent,
    limit: Number(s.alert.monthly_limit),
    pct: s.pct,
    message: alertMessage(s),
  }));
}
