"use client";

import { useState } from "react";
import type { Account, CreditCardStatus, CCPayment, Transfer } from "@/lib/types";
import { AccountList } from "./account-list";
import { CreditCards } from "./credit-cards";
import { TransferForm } from "./transfer-form";
import { PaymentForm } from "./payment-form";
import { ActivityLog } from "./activity-log";

type Tab = "overview" | "credit_cards" | "transfer" | "payment" | "activity";

export function AccountsView({
  accounts,
  ccStatus,
  payments,
  transfers,
}: {
  accounts: Account[];
  ccStatus: CreditCardStatus[];
  payments: CCPayment[];
  transfers: Transfer[];
}) {
  const [tab, setTab] = useState<Tab>("overview");

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "overview",     label: "Resumen",              icon: "🏦" },
    { key: "credit_cards", label: "Tarjetas de Crédito", icon: "💳" },
    { key: "payment",      label: "Pagar TC",             icon: "💸" },
    { key: "transfer",     label: "Transferir",           icon: "🔁" },
    { key: "activity",     label: "Actividad",            icon: "📜" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-surface-3">
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <AccountList accounts={accounts} />}
        {tab === "credit_cards" && (
          <CreditCards accounts={accounts} ccStatus={ccStatus} />
        )}
        {tab === "payment" && <PaymentForm accounts={accounts} />}
        {tab === "transfer" && <TransferForm accounts={accounts} />}
        {tab === "activity" && (
          <ActivityLog payments={payments} transfers={transfers} />
        )}
      </div>
    </div>
  );
}
