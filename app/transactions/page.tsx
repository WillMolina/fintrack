import { createServerSupabase } from "@/lib/supabase-server";
import { TransactionsView } from "./transactions-view";
import { format, startOfMonth, endOfMonth, parseISO, addMonths } from "date-fns";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  month?: string;       // YYYY-MM
  category?: string;    // category id
  account?: string;     // account id
  sort?: string;        // "date_desc" | "date_asc" | "amount_desc" | "amount_asc"
  type?: string;        // "all" | "expenses" | "income" | "credit"
}>;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  // Parse month
  const monthStr = sp.month || format(new Date(), "yyyy-MM");
  const monthDate = parseISO(`${monthStr}-01`);
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const supabase = await createServerSupabase();

  // Build query
  let query = supabase
    .from("transactions")
    .select("*, category:categories(*), account:accounts(*), billing_cycle:billing_cycles(*)")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  if (sp.category) query = query.eq("category_id", sp.category);
  if (sp.account) query = query.eq("account_id", sp.account);
  if (sp.type === "expenses") query = query.gt("amount", 0);
  if (sp.type === "income") query = query.lt("amount", 0);

  // Sort
  const sort = sp.sort || "date_desc";
  switch (sort) {
    case "date_asc":
      query = query.order("date", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    default:
      query = query.order("date", { ascending: false });
  }

  const { data: transactions } = await query.limit(500);

  // For "credit" filter, do client-side because we need to filter by account.type
  let filtered = transactions ?? [];
  if (sp.type === "credit") {
    filtered = filtered.filter(
      (t: { account?: { type?: string } | null }) => t.account?.type === "credit_card"
    );
  }

  // Filter options
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  // Month nav
  const prevMonth = format(addMonths(monthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const monthLabel = format(monthDate, "MMMM yyyy");

  // CC payments made this month count as real cash expenses
  const { data: ccPayments } = await supabase
    .from("cc_payments")
    .select("amount")
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd);
  const ccPaymentTotal = (ccPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  // Stats for header — exclude CC charges, add CC payments
  const totals = filtered.reduce(
    (acc, t) => {
      if (t.account?.type === "credit_card") return acc;
      const amt = Number(t.amount);
      if (amt > 0) acc.expenses += amt;
      else acc.income += Math.abs(amt);
      return acc;
    },
    { expenses: ccPaymentTotal, income: 0 }
  );

  const selectedAccount = (accounts ?? []).find((a) => a.id === sp.account);
  const balanceAccountId =
    selectedAccount && selectedAccount.type !== "credit_card" ? selectedAccount.id : null;

  const { data: balanceData } = await supabase.rpc("account_balance_at", {
    p_date: monthEnd,
    p_account_id: balanceAccountId,
  });
  const monthlyAccountBalance = balanceData ?? 0;

  return (
    <TransactionsView
      transactions={filtered}
      categories={categories ?? []}
      accounts={accounts ?? []}
      monthLabel={monthLabel}
      monthStr={monthStr}
      prevMonth={prevMonth}
      nextMonth={nextMonth}
      filters={{
        category: sp.category ?? "",
        account: sp.account ?? "",
        type: sp.type ?? "all",
        sort,
      }}
      totals={totals}
      monthlyAccountBalance={monthlyAccountBalance}
    />
  );
}
