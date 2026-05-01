import { createServerSupabase } from "@/lib/supabase-server";
import type {
  Account,
  BillingCycleSummary,
  Transaction,
} from "@/lib/types";
import { CreditCardCycleView } from "./credit-card-cycle-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  card?: string;
  cycle?: string;
}>;

export default async function CreditCardsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();

  const { data: cards } = await supabase
    .from("accounts")
    .select("*")
    .eq("type", "credit_card")
    .eq("is_active", true)
    .order("name")
    .returns<Account[]>();

  // Default to first card if none selected
  const selectedCardId = sp.card || cards?.[0]?.id || null;

  let cycles: BillingCycleSummary[] = [];
  let transactions: Transaction[] = [];
  let selectedCycleId: string | null = null;
  let selectedCard: Account | null = null;

  if (selectedCardId) {
    selectedCard = cards?.find((c) => c.id === selectedCardId) ?? null;

    const { data: cycleData } = await supabase
      .from("billing_cycle_summary")
      .select("*")
      .eq("account_id", selectedCardId)
      .order("cycle_end", { ascending: false })
      .limit(24)
      .returns<BillingCycleSummary[]>();

    cycles = cycleData ?? [];

    // Default to most recent cycle (the open one) if none selected
    selectedCycleId = sp.cycle || cycles[0]?.id || null;

    if (selectedCycleId) {
      const { data: txData } = await supabase
        .from("transactions")
        .select("*, category:categories(*), account:accounts(*), billing_cycle:billing_cycles(*)")
        .eq("billing_cycle_id", selectedCycleId)
        .order("date", { ascending: false });
      transactions = (txData ?? []) as Transaction[];
    }
  }

  return (
    <CreditCardCycleView
      cards={cards ?? []}
      selectedCard={selectedCard}
      cycles={cycles}
      selectedCycleId={selectedCycleId}
      transactions={transactions}
    />
  );
}
