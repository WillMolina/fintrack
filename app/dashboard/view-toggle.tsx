"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ViewToggle({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const setView = (view: string) => {
    const next = new URLSearchParams(params);
    next.set("view", view);
    router.push(`?${next.toString()}`);
  };

  return (
    <div className="inline-flex rounded-lg border border-surface-3 bg-surface-1 p-1">
      <button
        onClick={() => setView("charge")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          current === "charge"
            ? "bg-brand text-white"
            : "text-muted hover:text-white"
        }`}
      >
        💳 Charge Date
      </button>
      <button
        onClick={() => setView("cashflow")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          current === "cashflow"
            ? "bg-brand text-white"
            : "text-muted hover:text-white"
        }`}
      >
        💵 Cash Flow
      </button>
    </div>
  );
}
