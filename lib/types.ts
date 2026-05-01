export interface Account {
  id: string;
  name: string;
  type: "credit_card" | "debit" | "checking" | "savings" | "cash" | "other";
  currency: string;
  is_active: boolean;
  balance: number;
  starting_balance: number;
  credit_limit: number | null;
  statement_day: number | null;
  due_day: number | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  merchant: string | null;
  date: string;
  category_id: string | null;
  account_id: string | null;
  billing_cycle_id: string | null;
  source: "manual" | "webhook" | "import";
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  account?: Account;
  billing_cycle?: BillingCycle;
}

export interface BillingCycle {
  id: string;
  account_id: string;
  cycle_start: string;
  cycle_end: string;
  due_date: string;
  status: "open" | "closed" | "paid";
  statement_balance: number | null;
  created_at: string;
  account?: Account;
}

export interface BillingCycleSummary {
  id: string;
  account_id: string;
  account_name: string;
  credit_limit: number | null;
  cycle_start: string;
  cycle_end: string;
  due_date: string;
  status: "open" | "closed" | "paid";
  statement_balance: number | null;
  cycle_spending: number;
  transaction_count: number;
  paid_amount: number;
}

export interface Budget {
  id: string;
  category_id: string;
  month: string;
  amount_limit: number;
  created_at: string;
  category?: Category;
}

export interface CCPayment {
  id: string;
  credit_card_id: string;
  from_account_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  credit_card?: Account;
  from_account?: Account;
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  notes: string | null;
  created_at: string;
  from_account?: Account;
  to_account?: Account;
}

export interface CreditCardStatus {
  id: string;
  name: string;
  amount_owed: number;
  credit_limit: number | null;
  available_credit: number | null;
  utilization_pct: number | null;
  statement_day: number | null;
  due_day: number | null;
  cycle_start: string;
  cycle_end: string;
  due_date: string;
  cycle_spending: number;
}

export interface MonthlyCategoryTotal {
  month: string;
  category: string;
  color: string | null;
  icon: string | null;
  total: number;
  tx_count: number;
}

export interface MonthlySummary {
  month: string;
  total_expenses: number;
  total_income: number;
  net: number;
  tx_count: number;
}
