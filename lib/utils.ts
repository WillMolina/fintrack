import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string, fmt = "MMM d, yyyy"): string {
  return format(parseISO(dateStr), fmt);
}

export function getMonthRange(date: Date = new Date()) {
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Category colors for charts fallback
export const CHART_COLORS = [
  "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6",
  "#ec4899", "#10b981", "#06b6d4", "#71717a",
];
