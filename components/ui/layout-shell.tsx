"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { AddTransactionButton } from "./add-transaction-button";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAuthRoute = pathname === "/login";

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center gap-3 border-b border-surface-3 bg-surface-1 px-4 py-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-lg text-muted hover:text-white"
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <img src="/logo.svg" alt="" className="h-6 w-6" />
            <span className="text-base font-semibold">FinTrack</span>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
          </main>
        </div>
      </div>

      <AddTransactionButton variant="floating" />
    </>
  );
}
