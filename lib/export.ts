import type { SupabaseClient } from "@supabase/supabase-js";
import { format, parseISO, startOfMonth, addMonths } from "date-fns";
import type {
  Account,
  Budget,
  BillingCycleSummary,
  CCPayment,
  Category,
  Transaction,
  Transfer,
} from "@/lib/types";

// ============================================================
// Financial data export — structured for analysis by an LLM agent.
// Spending is grouped by category; transfers and CC payments are kept
// separate because they move money between own accounts, not spend it.
// ============================================================

const UNCATEGORIZED = "Sin categoría";
const PAGE_SIZE = 1000; // Supabase max rows per request

type TxRow = Pick<
  Transaction,
  "date" | "description" | "merchant" | "amount" | "notes" | "category_id" | "account_id"
>;

export interface ExportTx {
  date: string;
  description: string;
  merchant: string | null;
  account: string | null;
  account_type: Account["type"] | null;
  amount: number;
  notes: string | null;
}

export interface CategoryGroup {
  category: string;
  total: number;
  share_pct: number;
  monthly_avg: number;
  tx_count: number;
  by_month: Record<string, number>;
  top_merchants: { name: string; total: number; count: number }[];
  transactions: ExportTx[];
}

export interface FinancialExport {
  meta: {
    generated_at: string;
    period: { from: string; to: string; months: number };
    currencies: string[];
    conventions: string[];
  };
  totals: {
    income: number;
    spending: number;
    spending_on_credit_cards: number;
    net: number;
    savings_rate_pct: number | null;
    cc_payments: number;
    transfers: number;
  };
  accounts: {
    name: string;
    type: Account["type"];
    currency: string;
    is_active: boolean;
    current_balance: number;
    credit_limit: number | null;
    utilization_pct: number | null;
    statement_day: number | null;
    due_day: number | null;
  }[];
  monthly: {
    month: string;
    income: number;
    spending: number;
    spending_on_credit_cards: number;
    cc_payments: number;
    net: number;
    by_category: Record<string, number>;
  }[];
  spending_by_category: CategoryGroup[];
  income_by_category: CategoryGroup[];
  recurring_charges: {
    name: string;
    category: string;
    months_seen: number;
    avg_amount: number;
    last_date: string;
  }[];
  budgets: { month: string; category: string; limit: number; actual: number; diff: number }[];
  credit_card_cycles: {
    card: string;
    cycle_start: string;
    cycle_end: string;
    due_date: string;
    status: string;
    spending: number;
    statement_balance: number | null;
    paid: number;
    tx_count: number;
  }[];
  cc_payments: { date: string; card: string; from_account: string; amount: number; notes: string | null }[];
  transfers: { date: string; from_account: string; to_account: string; amount: number; notes: string | null }[];
}

const round = (n: number) => Math.round(n * 100) / 100;

async function fetchAllTransactions(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<TxRow[]> {
  const rows: TxRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select("date, description, merchant, amount, notes, category_id, account_id")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as TxRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function earliestTransactionDate(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("transactions")
    .select("date")
    .order("date", { ascending: true })
    .limit(1);
  return (data?.[0]?.date as string | undefined) ?? null;
}

function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let d = startOfMonth(parseISO(from));
  const end = startOfMonth(parseISO(to));
  while (d <= end) {
    months.push(format(d, "yyyy-MM"));
    d = addMonths(d, 1);
  }
  return months;
}

function groupByCategory(
  txs: (ExportTx & { category: string })[],
  months: string[],
  grandTotal: number
): CategoryGroup[] {
  const groups = new Map<string, (ExportTx & { category: string })[]>();
  for (const t of txs) {
    const list = groups.get(t.category) ?? [];
    list.push(t);
    groups.set(t.category, list);
  }

  return [...groups.entries()]
    .map(([category, list]) => {
      const total = list.reduce((s, t) => s + t.amount, 0);
      const byMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
      const merchants = new Map<string, { total: number; count: number }>();
      for (const t of list) {
        const m = t.date.slice(0, 7);
        byMonth[m] = round((byMonth[m] ?? 0) + t.amount);
        const key = t.merchant || t.description;
        const agg = merchants.get(key) ?? { total: 0, count: 0 };
        agg.total += t.amount;
        agg.count += 1;
        merchants.set(key, agg);
      }
      return {
        category,
        total: round(total),
        share_pct: grandTotal ? round((total / grandTotal) * 100) : 0,
        monthly_avg: round(total / months.length),
        tx_count: list.length,
        by_month: byMonth,
        top_merchants: [...merchants.entries()]
          .map(([name, v]) => ({ name, total: round(v.total), count: v.count }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5),
        transactions: list.map(({ category: _c, ...t }) => t),
      };
    })
    .sort((a, b) => b.total - a.total);
}

// Same merchant/description charged in 3+ distinct months → likely recurring
function detectRecurring(txs: (ExportTx & { category: string })[]) {
  const groups = new Map<string, { name: string; category: string; months: Set<string>; amounts: number[]; last: string }>();
  for (const t of txs) {
    const name = (t.merchant || t.description).trim();
    const key = name.toLowerCase().replace(/[0-9#*]+/g, "").replace(/\s+/g, " ").trim();
    if (!key) continue;
    const g = groups.get(key) ?? { name, category: t.category, months: new Set(), amounts: [], last: t.date };
    g.months.add(t.date.slice(0, 7));
    g.amounts.push(t.amount);
    if (t.date > g.last) g.last = t.date;
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.months.size >= 3)
    .map((g) => ({
      name: g.name,
      category: g.category,
      months_seen: g.months.size,
      avg_amount: round(g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length),
      last_date: g.last,
    }))
    .sort((a, b) => b.avg_amount * b.months_seen - a.avg_amount * a.months_seen);
}

export async function buildFinancialExport(
  supabase: SupabaseClient,
  from: string,
  to: string
): Promise<FinancialExport> {
  const [txRows, { data: accountsRaw }, { data: categoriesRaw }, { data: paymentsRaw }, { data: transfersRaw }, { data: cyclesRaw }, { data: budgetsRaw }] =
    await Promise.all([
      fetchAllTransactions(supabase, from, to),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("categories").select("*"),
      supabase
        .from("cc_payments")
        .select("*")
        .gte("payment_date", from)
        .lte("payment_date", to)
        .order("payment_date"),
      supabase
        .from("transfers")
        .select("*")
        .gte("transfer_date", from)
        .lte("transfer_date", to)
        .order("transfer_date"),
      supabase
        .from("billing_cycle_summary")
        .select("*")
        .lte("cycle_start", to)
        .gte("cycle_end", from),
      supabase
        .from("budgets")
        .select("*")
        .gte("month", format(startOfMonth(parseISO(from)), "yyyy-MM-dd"))
        .lte("month", to),
    ]);

  const accounts = (accountsRaw ?? []) as Account[];
  const categories = (categoriesRaw ?? []) as Category[];
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountName = (id: string | null) => (id ? accountById.get(id)?.name ?? "?" : "?");
  const months = monthsBetween(from, to);

  const txs = txRows.map((t) => {
    const acc = t.account_id ? accountById.get(t.account_id) : undefined;
    return {
      date: t.date,
      description: t.description,
      merchant: t.merchant,
      account: acc?.name ?? null,
      account_type: acc?.type ?? null,
      amount: Number(t.amount),
      notes: t.notes,
      category: (t.category_id && categoryById.get(t.category_id)?.name) || UNCATEGORIZED,
    };
  });

  const expenses = txs.filter((t) => t.amount > 0);
  // Income/refunds are stored negative; export them as positive amounts
  const income = txs.filter((t) => t.amount < 0).map((t) => ({ ...t, amount: -t.amount }));

  const totalSpending = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const ccSpending = expenses
    .filter((t) => t.account_type === "credit_card")
    .reduce((s, t) => s + t.amount, 0);

  const payments = (paymentsRaw ?? []) as CCPayment[];
  const transfers = (transfersRaw ?? []) as Transfer[];

  const monthly = months.map((m) => {
    const mExp = expenses.filter((t) => t.date.startsWith(m));
    const mInc = income.filter((t) => t.date.startsWith(m)).reduce((s, t) => s + t.amount, 0);
    const mSpend = mExp.reduce((s, t) => s + t.amount, 0);
    const byCategory: Record<string, number> = {};
    for (const t of mExp) byCategory[t.category] = round((byCategory[t.category] ?? 0) + t.amount);
    return {
      month: m,
      income: round(mInc),
      spending: round(mSpend),
      spending_on_credit_cards: round(
        mExp.filter((t) => t.account_type === "credit_card").reduce((s, t) => s + t.amount, 0)
      ),
      cc_payments: round(
        payments.filter((p) => p.payment_date.startsWith(m)).reduce((s, p) => s + Number(p.amount), 0)
      ),
      net: round(mInc - mSpend),
      by_category: byCategory,
    };
  });

  const spendingByCategory = groupByCategory(expenses, months, totalSpending);

  const budgets = ((budgetsRaw ?? []) as Budget[]).map((b) => {
    const cat = categoryById.get(b.category_id)?.name ?? UNCATEGORIZED;
    const m = b.month.slice(0, 7);
    const actual = spendingByCategory.find((g) => g.category === cat)?.by_month[m] ?? 0;
    return { month: m, category: cat, limit: Number(b.amount_limit), actual, diff: round(Number(b.amount_limit) - actual) };
  });

  return {
    meta: {
      generated_at: new Date().toISOString(),
      period: { from, to, months: months.length },
      currencies: [...new Set(accounts.map((a) => a.currency))],
      conventions: [
        "All amounts are positive numbers in the account currency; no currency conversion is applied.",
        "'spending' = every expense (cash, debit and credit card charges) on the date it happened — consumption basis.",
        "'income' includes salary, deposits and refunds.",
        "Credit card payments and transfers move money between the user's own accounts; they are NOT additional spending.",
        "Credit card 'current_balance' is the amount owed; for other accounts it is the money available.",
        "'recurring_charges' are heuristically detected: same merchant/description in 3+ different months.",
      ],
    },
    totals: {
      income: round(totalIncome),
      spending: round(totalSpending),
      spending_on_credit_cards: round(ccSpending),
      net: round(totalIncome - totalSpending),
      savings_rate_pct: totalIncome ? round(((totalIncome - totalSpending) / totalIncome) * 100) : null,
      cc_payments: round(payments.reduce((s, p) => s + Number(p.amount), 0)),
      transfers: round(transfers.reduce((s, t) => s + Number(t.amount), 0)),
    },
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      currency: a.currency,
      is_active: a.is_active,
      current_balance: Number(a.balance),
      credit_limit: a.credit_limit,
      utilization_pct:
        a.type === "credit_card" && a.credit_limit
          ? round((Number(a.balance) / Number(a.credit_limit)) * 100)
          : null,
      statement_day: a.statement_day,
      due_day: a.due_day,
    })),
    monthly,
    spending_by_category: spendingByCategory,
    income_by_category: groupByCategory(income, months, totalIncome),
    recurring_charges: detectRecurring(expenses),
    budgets,
    credit_card_cycles: ((cyclesRaw ?? []) as BillingCycleSummary[])
      .sort((a, b) => a.account_name.localeCompare(b.account_name) || a.cycle_start.localeCompare(b.cycle_start))
      .map((c) => ({
        card: c.account_name,
        cycle_start: c.cycle_start,
        cycle_end: c.cycle_end,
        due_date: c.due_date,
        status: c.status,
        spending: Number(c.cycle_spending),
        statement_balance: c.statement_balance === null ? null : Number(c.statement_balance),
        paid: Number(c.paid_amount),
        tx_count: Number(c.transaction_count),
      })),
    cc_payments: payments.map((p) => ({
      date: p.payment_date,
      card: accountName(p.credit_card_id),
      from_account: accountName(p.from_account_id),
      amount: Number(p.amount),
      notes: p.notes,
    })),
    transfers: transfers.map((t) => ({
      date: t.transfer_date,
      from_account: accountName(t.from_account_id),
      to_account: accountName(t.to_account_id),
      amount: Number(t.amount),
      notes: t.notes,
    })),
  };
}

// ============================================================
// Markdown rendering — compact tables an LLM can read directly
// ============================================================

const num = (n: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const cell = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v).replace(/\|/g, "/").replace(/\s*\n\s*/g, " ");

function table(headers: string[], rows: (string | number | null | undefined)[][]) {
  if (rows.length === 0) return "_None._\n";
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n") + "\n";
}

function categorySection(g: CategoryGroup, months: string[]) {
  return [
    `### ${g.category}`,
    "",
    `Total **${num(g.total)}** (${g.share_pct}%) · Monthly avg ${num(g.monthly_avg)} · ${g.tx_count} transactions`,
    "",
    table(months, [months.map((m) => num(g.by_month[m] ?? 0))]),
    "Top merchants:",
    "",
    table(
      ["Merchant", "Total", "Count"],
      g.top_merchants.map((m) => [m.name, num(m.total), m.count])
    ),
    "Transactions:",
    "",
    table(
      ["Date", "Description", "Merchant", "Account", "Amount", "Notes"],
      g.transactions.map((t) => [t.date, t.description, t.merchant, t.account, num(t.amount), t.notes])
    ),
  ].join("\n");
}

export function renderExportMarkdown(d: FinancialExport): string {
  const months = d.monthly.map((m) => m.month);
  const out: string[] = [];

  out.push(
    `# Personal finance data — ${d.meta.period.from} to ${d.meta.period.to}`,
    "",
    `Generated ${d.meta.generated_at} by FinTrack. Currency: ${d.meta.currencies.join(", ") || "—"}. Period: ${d.meta.period.months} months.`,
    "",
    "## How to read this data",
    "",
    ...d.meta.conventions.map((c) => `- ${c}`),
    "",
    "## Overview",
    "",
    table(
      ["Metric", "Value"],
      [
        ["Total income", num(d.totals.income)],
        ["Total spending", num(d.totals.spending)],
        ["…of which on credit cards", num(d.totals.spending_on_credit_cards)],
        ["Net (income − spending)", num(d.totals.net)],
        ["Savings rate", d.totals.savings_rate_pct === null ? null : `${d.totals.savings_rate_pct}%`],
        ["Credit card payments made", num(d.totals.cc_payments)],
        ["Transfers between own accounts", num(d.totals.transfers)],
      ]
    ),
    "## Accounts (current state)",
    "",
    table(
      ["Account", "Type", "Currency", "Balance / owed", "Credit limit", "Utilization", "Statement day", "Due day", "Active"],
      d.accounts.map((a) => [
        a.name,
        a.type,
        a.currency,
        num(a.current_balance),
        a.credit_limit === null ? null : num(a.credit_limit),
        a.utilization_pct === null ? null : `${a.utilization_pct}%`,
        a.statement_day,
        a.due_day,
        a.is_active ? "yes" : "no",
      ])
    ),
    "## Monthly summary",
    "",
    table(
      ["Month", "Income", "Spending", "On credit cards", "CC payments", "Net"],
      d.monthly.map((m) => [m.month, num(m.income), num(m.spending), num(m.spending_on_credit_cards), num(m.cc_payments), num(m.net)])
    ),
    "## Spending by category per month",
    "",
    table(
      ["Category", ...months, "Total", "%"],
      d.spending_by_category.map((g) => [
        g.category,
        ...months.map((m) => num(g.by_month[m] ?? 0)),
        num(g.total),
        `${g.share_pct}%`,
      ])
    ),
    "## Likely recurring charges",
    "",
    table(
      ["Name", "Category", "Months seen", "Avg amount", "Last charge"],
      d.recurring_charges.map((r) => [r.name, r.category, r.months_seen, num(r.avg_amount), r.last_date])
    )
  );

  if (d.budgets.length > 0) {
    out.push(
      "## Budgets vs actual",
      "",
      table(
        ["Month", "Category", "Limit", "Actual", "Remaining"],
        d.budgets.map((b) => [b.month, b.category, num(b.limit), num(b.actual), num(b.diff)])
      )
    );
  }

  out.push(
    "## Credit card billing cycles",
    "",
    table(
      ["Card", "Cycle", "Due", "Status", "Spending", "Statement balance", "Paid", "Tx"],
      d.credit_card_cycles.map((c) => [
        c.card,
        `${c.cycle_start} → ${c.cycle_end}`,
        c.due_date,
        c.status,
        num(c.spending),
        c.statement_balance === null ? null : num(c.statement_balance),
        num(c.paid),
        c.tx_count,
      ])
    ),
    "## Credit card payments",
    "",
    table(
      ["Date", "Card", "Paid from", "Amount", "Notes"],
      d.cc_payments.map((p) => [p.date, p.card, p.from_account, num(p.amount), p.notes])
    ),
    "## Transfers between own accounts",
    "",
    table(
      ["Date", "From", "To", "Amount", "Notes"],
      d.transfers.map((t) => [t.date, t.from_account, t.to_account, num(t.amount), t.notes])
    ),
    "## Spending detail by category",
    "",
    ...d.spending_by_category.map((g) => categorySection(g, months)),
    "## Income detail by category",
    "",
    ...d.income_by_category.map((g) => categorySection(g, months))
  );

  return out.join("\n");
}
