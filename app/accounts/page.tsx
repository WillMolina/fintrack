import { createServerSupabase } from "@/lib/supabase-server";
import type { Account, CreditCardStatus, CCPayment, Transfer } from "@/lib/types";
import { AccountsView } from "./accounts-view";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createServerSupabase();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const { data: ccStatus } = await supabase
    .from("credit_card_status")
    .select("*")
    .returns<CreditCardStatus[]>();

  const { data: payments } = await supabase
    .from("cc_payments")
    .select("*, credit_card:accounts!cc_payments_credit_card_id_fkey(*), from_account:accounts!cc_payments_from_account_id_fkey(*)")
    .order("payment_date", { ascending: false })
    .limit(20);

  const { data: transfers } = await supabase
    .from("transfers")
    .select("*, from_account:accounts!transfers_from_account_id_fkey(*), to_account:accounts!transfers_to_account_id_fkey(*)")
    .order("transfer_date", { ascending: false })
    .limit(20);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
      <p className="mt-1 text-sm text-muted">
        Administra saldos, tarjetas de crédito y transferencias
      </p>
      <div className="mt-6">
        <AccountsView
          accounts={(accounts ?? []) as Account[]}
          ccStatus={ccStatus ?? []}
          payments={(payments ?? []) as CCPayment[]}
          transfers={(transfers ?? []) as Transfer[]}
        />
      </div>
    </div>
  );
}
