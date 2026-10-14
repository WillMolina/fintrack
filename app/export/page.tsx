import { ExportView } from "./export-view";

export default function ExportPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Exportar datos</h1>
      <p className="mt-1 text-sm text-muted">
        Descarga tus finanzas organizadas por categoría para analizarlas con un agente de IA
      </p>
      <div className="mt-6">
        <ExportView />
      </div>
    </div>
  );
}
