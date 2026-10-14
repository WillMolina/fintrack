"use client";

import { useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";

const PRESETS = [
  { label: "3 meses", months: 3 },
  { label: "6 meses", months: 6 },
  { label: "12 meses", months: 12 },
  { label: "Todo", months: null },
] as const;

const SUGGESTED_PROMPT = `Eres un asesor financiero personal. Adjunto un export de mis finanzas (ingresos, gastos por categoría, cuentas, tarjetas de crédito, pagos y transferencias). Lee primero la sección "How to read this data".

Con base en mi realidad financiera:
1. Resume mi situación: ingreso promedio, gasto promedio, tasa de ahorro y tendencia mes a mes.
2. Identifica las categorías y comercios donde más se va el dinero y cuáles están creciendo.
3. Revisa los cargos recurrentes y suscripciones que podría cancelar o renegociar.
4. Evalúa el uso de mis tarjetas de crédito (utilización, pagos a tiempo, si pago el total del ciclo).
5. Dame 5–10 recomendaciones concretas y priorizadas, con el ahorro mensual estimado de cada una.
6. Propón un presupuesto mensual por categoría realista para mí.

Usa cifras de los datos; si algo no se puede concluir, dilo.`;

export function ExportView() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [preset, setPreset] = useState<number | null>(12);
  const [from, setFrom] = useState(
    format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd")
  );
  const [to, setTo] = useState(today);
  const [copied, setCopied] = useState(false);

  const applyPreset = (months: number | null) => {
    setPreset(months);
    setTo(today);
    if (months !== null) {
      setFrom(format(startOfMonth(subMonths(new Date(), months - 1)), "yyyy-MM-dd"));
    }
  };

  const href = (fmt: "md" | "json") => {
    const params = new URLSearchParams({
      from: preset === null ? "all" : from,
      to,
      format: fmt,
    });
    return `/api/export?${params.toString()}`;
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(SUGGESTED_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inputClass =
    "rounded-lg border border-surface-4 bg-surface-2 px-3 py-1.5 text-sm text-white focus:border-brand focus:outline-none disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <h2 className="font-medium">1. Elige el periodo</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.months)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                preset === p.months
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-surface-4 text-muted hover:text-white"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="mx-2 text-sm text-muted">o</span>
          <input
            type="date"
            value={from}
            max={to}
            disabled={preset === null}
            onChange={(e) => {
              setPreset(-1);
              setFrom(e.target.value);
            }}
            className={inputClass}
          />
          <span className="text-sm text-muted">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              if (preset !== null) setPreset(-1);
              setTo(e.target.value);
            }}
            className={inputClass}
          />
        </div>
      </div>

      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <h2 className="font-medium">2. Descarga</h2>
        <p className="mt-1 text-sm text-muted">
          Incluye resumen mensual, gastos e ingresos por categoría con cada transacción,
          cuentas, ciclos de tarjeta, pagos, transferencias y cargos recurrentes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={href("md")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim"
          >
            Descargar Markdown
          </a>
          <a
            href={href("json")}
            className="rounded-lg border border-surface-4 px-4 py-2 text-sm text-muted hover:text-white"
          >
            Descargar JSON
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">
          Markdown es ideal para pegar o adjuntar en un chat (Claude, ChatGPT). JSON sirve
          para agentes o scripts que procesan los datos.
        </p>
      </div>

      <div className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">3. Prompt sugerido</h2>
          <button
            onClick={copyPrompt}
            className="rounded-lg border border-surface-4 px-3 py-1.5 text-sm text-muted hover:text-white"
          >
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-xs leading-relaxed text-muted">
          {SUGGESTED_PROMPT}
        </pre>
      </div>
    </div>
  );
}
