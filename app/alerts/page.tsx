import { format } from "date-fns";
import { createServerSupabase } from "@/lib/supabase-server";
import { getAlertStatuses } from "@/lib/alerts";
import { AlertsManager } from "./alerts-manager";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const supabase = await createServerSupabase();
  const monthStr = format(new Date(), "yyyy-MM");

  const [{ data: categories }, statuses] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    getAlertStatuses(supabase, monthStr),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Alertas de gasto</h1>
      <p className="mt-1 text-sm text-muted">
        Define topes mensuales por categoría (y opcionalmente por descripción) y recibe
        un aviso cuando te acerques
      </p>
      <div className="mt-6">
        <AlertsManager categories={categories ?? []} statuses={statuses} />
      </div>
    </div>
  );
}
