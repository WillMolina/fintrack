"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Category, Account } from "@/lib/types";
import { AddTransactionModal } from "./add-transaction-modal";

export function AddTransactionButton({
  variant = "floating",
}: {
  variant?: "floating" | "primary" | "inline";
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Lazy-load data only when modal is first opened
  const handleOpen = async () => {
    if (!loaded) {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("accounts")
          .select("*")
          .eq("is_active", true)
          .order("name"),
      ]);
      setCategories((cats ?? []) as Category[]);
      setAccounts((accs ?? []) as Account[]);
      setLoaded(true);
    }
    setOpen(true);
  };

  // Listen for global event so any component can trigger this
  useEffect(() => {
    const handler = () => handleOpen();
    window.addEventListener("open-add-transaction", handler);
    return () => window.removeEventListener("open-add-transaction", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buttonClasses = {
    floating:
      "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 text-2xl text-white shadow-lg shadow-purple-600/30 transition-transform hover:scale-110 active:scale-95",
    primary:
      "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dim transition-colors",
    inline:
      "inline-flex items-center gap-2 rounded-lg border border-surface-4 px-3 py-1.5 text-sm font-medium text-muted hover:text-white hover:border-brand transition-colors",
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={buttonClasses[variant]}
        title="Add transaction"
      >
        {variant === "floating" ? "+" : (
          <>
            <span>+</span>
            <span>Add Transaction</span>
          </>
        )}
      </button>
      <AddTransactionModal
        open={open}
        onClose={() => setOpen(false)}
        categories={categories}
        accounts={accounts}
      />
    </>
  );
}

// Helper to trigger modal from anywhere
export function triggerAddTransaction() {
  window.dispatchEvent(new Event("open-add-transaction"));
}
