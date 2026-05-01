"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Transaction } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    setDeleting(id);
    await supabase.from("transactions").delete().eq("id", id);
    setDeleting(null);
    router.refresh();
  };

  if (transactions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-surface-3 bg-surface-1 text-sm text-muted">
        Sin transacciones aún. Agrega una o conecta tu webhook de Make.com.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-surface-3 bg-surface-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-3 text-left text-xs uppercase tracking-wider text-muted">
            <th className="px-5 py-3">Fecha</th>
            <th className="px-5 py-3">Descripción</th>
            <th className="px-5 py-3">Categoría</th>
            <th className="px-5 py-3">Cuenta</th>
            <th className="px-5 py-3">Origen</th>
            <th className="px-5 py-3 text-right">Monto</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-3">
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              className="hover:bg-surface-2 transition-colors"
            >
              <td className="px-5 py-3 tabular-nums text-muted">
                {formatDate(tx.date, "MMM d, yyyy")}
              </td>
              <td className="px-5 py-3">
                <div>{tx.description}</div>
                {tx.merchant && (
                  <div className="text-xs text-muted">{tx.merchant}</div>
                )}
              </td>
              <td className="px-5 py-3">
                {tx.category ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs">
                    <span>{tx.category.icon}</span>
                    {tx.category.name}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-5 py-3 text-muted">
                {tx.account?.name ?? "—"}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    tx.source === "webhook"
                      ? "bg-blue-500/10 text-blue-400"
                      : tx.source === "import"
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-surface-3 text-muted"
                  }`}
                >
                  {tx.source}
                </span>
              </td>
              <td
                className={`px-5 py-3 text-right tabular-nums font-medium ${
                  tx.amount > 0 ? "text-danger" : "text-brand"
                }`}
              >
                {tx.amount > 0 ? "-" : "+"}
                {formatCurrency(Math.abs(tx.amount))}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => handleDelete(tx.id)}
                  disabled={deleting === tx.id}
                  className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  title="Eliminar"
                >
                  {deleting === tx.id ? "…" : "✕"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
