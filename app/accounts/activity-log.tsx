"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { CCPayment, Transfer } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function ActivityLog({
  payments,
  transfers,
}: {
  payments: CCPayment[];
  transfers: Transfer[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [filter, setFilter] = useState<"all" | "payments" | "transfers">("all");

  const handleDeletePayment = async (id: string) => {
    if (!confirm("Delete this payment? Balances will be reverted.")) return;
    await supabase.from("cc_payments").delete().eq("id", id);
    router.refresh();
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!confirm("Delete this transfer? Balances will be reverted.")) return;
    await supabase.from("transfers").delete().eq("id", id);
    router.refresh();
  };

  type Item =
    | { kind: "payment"; data: CCPayment; date: string }
    | { kind: "transfer"; data: Transfer; date: string };

  const items: Item[] = [
    ...(filter !== "transfers"
      ? payments.map<Item>((p) => ({
          kind: "payment",
          data: p,
          date: p.payment_date,
        }))
      : []),
    ...(filter !== "payments"
      ? transfers.map<Item>((t) => ({
          kind: "transfer",
          data: t,
          date: t.transfer_date,
        }))
      : []),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["all", "payments", "transfers"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f
                ? "bg-brand/10 text-brand"
                : "bg-surface-2 text-muted hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-8 text-center text-sm text-muted">
          No activity yet
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Details</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-3">
              {items.map((item) => {
                const isPayment = item.kind === "payment";
                return (
                  <tr
                    key={`${item.kind}-${item.data.id}`}
                    className="hover:bg-surface-2 transition-colors"
                  >
                    <td className="px-5 py-3 tabular-nums text-muted">
                      {formatDate(item.date, "MMM d, yyyy")}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                          isPayment
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {isPayment ? "💸 Payment" : "🔁 Transfer"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {isPayment ? (
                        <div>
                          <div>
                            {(item.data as CCPayment).from_account?.name} →{" "}
                            {(item.data as CCPayment).credit_card?.name}
                          </div>
                          {item.data.notes && (
                            <div className="text-xs text-muted">
                              {item.data.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div>
                            {(item.data as Transfer).from_account?.name} →{" "}
                            {(item.data as Transfer).to_account?.name}
                          </div>
                          {item.data.notes && (
                            <div className="text-xs text-muted">
                              {item.data.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(item.data.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() =>
                          isPayment
                            ? handleDeletePayment(item.data.id)
                            : handleDeleteTransfer(item.data.id)
                        }
                        className="rounded p-1 text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
