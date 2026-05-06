import { createServerSupabase } from "@/lib/supabase-server";
import { format, startOfMonth, endOfMonth, parseISO, addMonths, subMonths } from "date-fns";
import type { Account, BillingCycleSummary, MonthlyCategoryTotal } from "@/lib/types";
import { DashboardView } from "./dashboard-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ month?: string }>;
type MonthlyTrend = { month: string; total_expenses: number; total_income: number };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const monthStr = sp.month || format(new Date(), "yyyy-MM");
  const monthDate = parseISO(`${monthStr}-01`);
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const prevMonthStr = format(subMonths(monthDate, 1), "yyyy-MM");
  const nextMonthStr = format(addMonths(monthDate, 1), "yyyy-MM");
  const monthLabel = format(monthDate, "MMMM yyyy");

  const supabase = await createServerSupabase();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name")
    .returns<Account[]>();

  const savingsAccount = (accounts ?? []).find((a) => a.name === "Ahorros Davibank");
  const ccAccounts = (accounts ?? []).filter((a) => a.type === "credit_card");

  // Savings account balance at end of selected month
  const { data: savingsBalance } = savingsAccount
    ? await supabase.rpc("account_balance_at", {
        p_date: monthEnd,
        p_account_id: savingsAccount.id,
      })
    : { data: 0 };

  // Open billing cycle debt + earliest cycle end for countdown
  const { data: openCycles } = await supabase
    .from("billing_cycle_summary")
    .select("account_id, cycle_spending, cycle_end")
    .eq("status", "open");

  const totalCCDebt = (openCycles ?? []).reduce(
    (s, c) => s + Number(c.cycle_spending),
    0
  );
  const earliestCycleEnd = (openCycles ?? [])
    .map((c) => c.cycle_end as string)
    .sort()[0] ?? null;

  // 6-month non-CC spending trend via RPC (same logic as transactions view)
  const { data: trendRaw } = await supabase.rpc("monthly_spending_non_cc", {
    p_end_date: monthEnd,
    p_months: 6,
  });
  const trendData = (trendRaw ?? []) as MonthlyTrend[];

  // Extract selected month totals from trend data for the summary card
  const selectedMonthTrend = trendData.find((d) =>
    d.month.startsWith(monthStr)
  ) ?? { total_expenses: 0, total_income: 0 };

  // CC payments made this month are real cash outflows — add to expenses
  const { data: ccPayments } = await supabase
    .from("cc_payments")
    .select("amount")
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd);
  const ccPaymentTotal = (ccPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const monthExpenses = Number(selectedMonthTrend.total_expenses) + ccPaymentTotal;
  const monthIncome = Number(selectedMonthTrend.total_income);

  // Last 3 cycles per CC account
  const { data: ccCycles } = ccAccounts.length
    ? await supabase
        .from("billing_cycle_summary")
        .select("*")
        .in("account_id", ccAccounts.map((a) => a.id))
        .order("cycle_end", { ascending: false })
        .limit(ccAccounts.length * 3)
        .returns<BillingCycleSummary[]>()
    : { data: [] };

  // Top 6 categories for selected month, excluding "Deudas"
  const { data: categoryRaw } = await supabase
    .from("monthly_category_totals")
    .select("*")
    .eq("month", monthStart)
    .order("total", { ascending: false })
    .returns<MonthlyCategoryTotal[]>();

  const topCategories = (categoryRaw ?? [])
    .filter((c) => c.category !== "Deudas")
    .slice(0, 6);

  return (
    <DashboardView
      monthStr={monthStr}
      monthLabel={monthLabel}
      prevMonth={prevMonthStr}
      nextMonth={nextMonthStr}
      savingsBalance={Number(savingsBalance ?? 0)}
      savingsAccountName={savingsAccount?.name ?? "Main Account"}
      totalCCDebt={totalCCDebt}
      earliestCycleEnd={earliestCycleEnd}
      monthExpenses={monthExpenses}
      monthIncome={monthIncome}
      trendData={trendData}
      ccCycles={ccCycles ?? []}
      ccAccounts={ccAccounts}
      topCategories={topCategories}
    />
  );
}
